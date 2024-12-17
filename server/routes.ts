import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { setupWebSocket } from "./websocket";
import { db } from "@db";
import { users, servers, streams, permissions, type User } from "@db/schema";
import { eq, and } from "drizzle-orm";
import type { FlussonicStreamsResponse } from "./flussonic";
import { flussonicService, StreamStatisticsService } from "./services/flussonic";

// Extend Express Request type to include our User type
declare global {
  namespace Express {
    interface User extends typeof users.$inferSelect {}
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
  app.get("/api/servers/:serverId/streams", requireAuth, async (req, res) => {
    ensureAuthenticated(req);
    const serverId = parseInt(req.params.serverId);
    
    try {
      // Get server info
      const [server] = await db
        .select()
        .from(servers)
        .where(eq(servers.id, serverId))
        .limit(1);
        
      if (!server) {
        return res.status(404).send("Server not found");
      }

      // First get streams from database
      let streamsQuery = db
        .select()
        .from(streams)
        .where(eq(streams.serverId, serverId));
      
      if (!req.user.isAdmin) {
        streamsQuery = streamsQuery
          .innerJoin(permissions, eq(permissions.streamId, streams.id))
          .where(eq(permissions.userId, req.user.id));
      }
      
      const streamData = await streamsQuery;
      
      // Then get active streams from Flussonic
      try {
        console.log(`Fetching streams for server ${server.name} (${server.url})`);
        const activeStreams = await flussonicService.getStreams(server);
        console.log('Active streams received:', activeStreams);
        
        // Merge stream data with active status
        const enrichedStreams = streamData.map(stream => {
          console.log(`Looking for stream with key: ${stream.streamKey}`);
          const activeStream = activeStreams.find(as => as.name === stream.streamKey);
          console.log(`Stream ${stream.streamKey} status:`, activeStream || 'not found');
          return {
            ...stream,
            streamStatus: activeStream || null
          };
        });
        
        console.log('Sending enriched streams:', enrichedStreams);
        res.json(enrichedStreams);
      } catch (error) {
        console.error('Error fetching streams from Flussonic:', error);
        // Still return the basic stream data even if Flussonic fetch fails
        const enrichedStreams = streamData.map(stream => ({
          ...stream,
          streamStatus: null
        }));
        res.json(enrichedStreams);
      }
    } catch (error) {
      console.error('Error fetching streams:', error);
      res.status(500).json({ error: 'Failed to fetch streams' });
    }
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

  return httpServer;
}