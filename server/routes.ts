import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { setupWebSocket } from "./websocket";
import { db } from "@db";
import { users, servers, streams, permissions, type User } from "@db/schema";
import { eq, and } from "drizzle-orm";
import { setupFlussonicIntegration, type FlussonicStreamsResponse } from "./flussonic";
import { flussonicService } from "./services/flussonic";

// Extend Express Request type to include our User type
declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

interface AuthenticatedRequest extends Request {
  user: User;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).send("Unauthorized");
  }
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).send("Unauthorized");
  }
  
  const user = req.user as User;
  if (!user.isAdmin) {
    return res.status(403).send("Forbidden");
  }
  
  next();
}

// Helper to ensure request is authenticated
function ensureAuthenticated(req: Request): asserts req is AuthenticatedRequest {
  if (!req.isAuthenticated() || !req.user) {
    throw new Error("User is not authenticated");
  }
}

export function registerRoutes(app: Express): Server {
  // Setup authentication routes
  setupAuth(app);

  // User routes
  app.get("/api/users", requireAdmin, async (req, res) => {
    const allUsers = await db.select().from(users);
    res.json(allUsers);
  });

  app.post("/api/users", requireAdmin, async (req, res) => {
    const { username, password, isAdmin } = req.body;
    const newUser = await db.insert(users).values({ username, password, isAdmin }).returning();
    res.json(newUser[0]);
  });

  // Server routes
  app.get("/api/servers", requireAuth, async (req, res) => {
    const allServers = await db.select().from(servers);
    res.json(allServers);
  });

  app.get("/api/servers/health", requireAuth, async (req, res) => {
    try {
      const allServers = await db.select().from(servers);
      const serversWithHealth = await Promise.all(
        allServers.map(async (server) => {
          try {
            // Only fetch streams stats since system stats may not be available
            await flussonicService.validateAuth(server);
            const streamsStats = await flussonicService.makeAuthenticatedRequest<FlussonicStreamsResponse>(server, '/streams');
            
            // Calculate health metrics from streams data
            const activeStreams = streamsStats.streams.length;
            const totalBandwidth = streamsStats.streams.reduce((sum, stream) => {
              return sum + (stream.input?.bytes_in || 0);
            }, 0);

            return {
              ...server,
              health: {
                status: 'online',
                cpuUsage: 0, // Not available from API
                memoryUsage: 0, // Not available from API
                activeStreams,
                totalBandwidth,
                lastChecked: new Date().toISOString(),
              },
            };
          } catch (error) {
            return {
              ...server,
              health: {
                status: 'offline',
                cpuUsage: 0,
                memoryUsage: 0,
                activeStreams: 0,
                totalBandwidth: 0,
                lastChecked: new Date().toISOString(),
              },
            };
          }
        })
      );
      res.json(serversWithHealth);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch server health metrics" });
    }
  });

  app.post("/api/servers", requireAdmin, async (req, res) => {
    const { name, url, username, password } = req.body;
    
    try {
      // Test connection before saving
      const server = { 
        name, 
        url, 
        username, 
        password,
        status: 'offline',
      } as typeof servers.$inferInsert;
      
      // Validate connection
      await flussonicService.validateAuth(server);
      
      const [newServer] = await db
        .insert(servers)
        .values({
          ...server,
          status: 'online',
          lastSuccessfulAuthAt: new Date(),
        })
        .returning();
      
      res.json(newServer);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create server';
      res.status(400).send(errorMessage);
    }
  });

  app.post("/api/servers/:id/test", requireAdmin, async (req, res) => {
    const serverId = parseInt(req.params.id);
    
    try {
      const [server] = await db
        .select()
        .from(servers)
        .where(eq(servers.id, serverId))
        .limit(1);

      if (!server) {
        return res.status(404).send("Server not found");
      }

      // Test authentication
      await flussonicService.validateAuth(server);
      
      // Update server status
      const [updatedServer] = await db
        .update(servers)
        .set({
          status: 'online',
          lastSuccessfulAuthAt: new Date(),
          lastError: null,
          lastErrorAt: null,
        })
        .where(eq(servers.id, serverId))
        .returning();

      res.json(updatedServer);
    } catch (error: any) {
      // Update server status with error
      const [updatedServer] = await db
        .update(servers)
        .set({
          status: 'offline',
          lastError: error.message,
          lastErrorAt: new Date(),
        })
        .where(eq(servers.id, serverId))
        .returning();

      res.status(400).json(updatedServer);
    }
  });

  // Stream routes
  app.get("/api/streams", requireAuth, async (req, res) => {
    ensureAuthenticated(req);
    
    if (req.user.isAdmin) {
      const allStreams = await db.select().from(streams);
      return res.json(allStreams);
    }

    const userStreams = await db
      .select()
      .from(streams)
      .innerJoin(permissions, eq(permissions.streamId, streams.id))
      .where(eq(permissions.userId, req.user.id));
    res.json(userStreams);
  });

  app.post("/api/streams", requireAdmin, async (req, res) => {
    const { serverId, name, streamKey } = req.body;
    const newStream = await db
      .insert(streams)
      .values({ serverId, name, streamKey })
      .returning();
    res.json(newStream[0]);
  });

  // Permission routes
  app.get("/api/permissions", requireAdmin, async (req, res) => {
    const allPermissions = await db.select().from(permissions);
    res.json(allPermissions);
  });

  app.post("/api/permissions", requireAdmin, async (req, res) => {
    const { userId, streamId } = req.body;
    const newPermission = await db
      .insert(permissions)
      .values({ userId, streamId })
      .returning();
    res.json(newPermission[0]);
  });

  const httpServer = createServer(app);

  // Setup WebSocket server for real-time updates
  setupWebSocket(httpServer);

  // Setup Flussonic integration
  setupFlussonicIntegration();

  return httpServer;
}
