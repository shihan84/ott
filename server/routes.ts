import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { setupWebSocket } from "./websocket";
import { db } from "@db";
import { users, servers, streams, permissions, trafficStats, type User } from "@db/schema";
import { eq, sql, and, between } from "drizzle-orm";
import type { FlussonicStreamsResponse } from "./flussonic";
import { flussonicService, StreamStatisticsService } from "./services/flussonic";
import { crypto } from "./auth";

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
  app.get("/api/users", requireAdmin, async (_req, res) => {
    try {
      const allUsers = await db.select().from(users);
      res.json(allUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).send("Failed to fetch users");
    }
  });

  app.post("/api/users", requireAdmin, async (req, res) => {
    try {
      const { username, password, isAdmin } = req.body;
      
      // Check if user already exists
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (existingUser.length > 0) {
        return res.status(400).send("Username already exists");
      }

      // Hash password
      const hashedPassword = await crypto.hash(password);

      // Create new user
      const [newUser] = await db
        .insert(users)
        .values({
          username,
          password: hashedPassword,
          isAdmin: isAdmin || false,
        })
        .returning();

      res.json(newUser);
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).send("Failed to create user");
    }
  });

  app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Prevent deletion of the last admin user
      if (req.user?.isAdmin) {
        const adminCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(users)
          .where(eq(users.isAdmin, true));
        
        if (adminCount[0].count <= 1) {
          return res.status(400).send("Cannot delete the last admin user");
        }
      }

      const [deletedUser] = await db
        .delete(users)
        .where(eq(users.id, userId))
        .returning();

      if (!deletedUser) {
        return res.status(404).send("User not found");
      }

      res.json(deletedUser);
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).send("Failed to delete user");
    }
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

  app.delete("/api/servers/:id", requireAdmin, async (req, res) => {
    const serverId = parseInt(req.params.id);
    
    try {
      // First delete associated streams
      await db
        .delete(streams)
        .where(eq(streams.serverId, serverId));
      
      // Then delete the server
      const [deletedServer] = await db
        .delete(servers)
        .where(eq(servers.id, serverId))
        .returning();
      
      if (!deletedServer) {
        return res.status(404).send("Server not found");
      }
      
      res.json(deletedServer);
    } catch (error) {
      console.error('Error deleting server:', error);
      res.status(500).send("Failed to delete server");
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
    const user = req.user;
    
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

      console.log('Starting stream fetch for server:', serverId);
      
      // First fetch active streams from Flussonic
      console.log(`Fetching streams from Flussonic for server ${server.name} (${server.url})`);
      const activeStreams = await flussonicService.getStreams(server);
      console.log('Flussonic streams received:', activeStreams.length);

      // For each active stream, create or update in database
      for (const activeStream of activeStreams) {
        const streamKey = activeStream.name;
        const [existingStream] = await db
          .select()
          .from(streams)
          .where(and(
            eq(streams.serverId, serverId),
            eq(streams.streamKey, streamKey)
          ))
          .limit(1);

        if (!existingStream) {
          // Create new stream
          const [newStream] = await db
            .insert(streams)
            .values({
              serverId,
              name: streamKey,
              streamKey,
              active: true,
              lastSeen: new Date(),
              streamStatus: activeStream
            })
            .returning();

          // If admin is creating the stream, give them access
          if (user.isAdmin) {
            await db.insert(permissions).values({
              userId: user.id,
              streamId: newStream.id
            });
          }
        } else {
          // Update existing stream
          await db
            .update(streams)
            .set({
              active: true,
              lastSeen: new Date(),
              streamStatus: activeStream
            })
            .where(eq(streams.id, existingStream.id));
        }
      }

      // Now get all streams from database with permissions
      const query = user.isAdmin
        ? db
            .select({
              id: streams.id,
              name: streams.name,
              streamKey: streams.streamKey,
              active: streams.active,
              lastSeen: streams.lastSeen,
              streamStatus: streams.streamStatus,
              serverId: streams.serverId,
              createdAt: streams.createdAt
            })
            .from(streams)
            .where(eq(streams.serverId, serverId))
        : db
            .select({
              id: streams.id,
              name: streams.name,
              streamKey: streams.streamKey,
              active: streams.active,
              lastSeen: streams.lastSeen,
              streamStatus: streams.streamStatus,
              serverId: streams.serverId,
              createdAt: streams.createdAt
            })
            .from(streams)
            .innerJoin(permissions, eq(permissions.streamId, streams.id))
            .where(and(
              eq(streams.serverId, serverId),
              eq(permissions.userId, user.id)
            ));

      const finalStreams = await query;
      console.log(`Total streams found for ${user.isAdmin ? 'admin' : 'user'} ${user.username}:`, finalStreams.length);
      
      res.json(finalStreams);
    } catch (error) {
      console.error('Error in stream processing:', error);
      res.status(500).json({ error: 'Failed to process streams' });
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
  app.get("/api/users/:userId/permissions", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const userPermissions = await db
        .select()
        .from(permissions)
        .where(eq(permissions.userId, userId));
      res.json(userPermissions);
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      res.status(500).send("Failed to fetch permissions");
    }
  });

  app.post("/api/permissions", requireAdmin, async (req, res) => {
    try {
      const { userId, streamId } = req.body;
      
      // Check if permission already exists
      const [existingPermission] = await db
        .select()
        .from(permissions)
        .where(and(
          eq(permissions.userId, userId),
          eq(permissions.streamId, streamId)
        ))
        .limit(1);

      if (existingPermission) {
        return res.status(400).send("Permission already exists");
      }

      const [newPermission] = await db
        .insert(permissions)
        .values({ userId, streamId })
        .returning();
        
      res.json(newPermission);
    } catch (error) {
      console.error('Error creating permission:', error);
      res.status(500).send("Failed to create permission");
    }
  });

  app.delete("/api/permissions/:userId/:streamId", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const streamId = parseInt(req.params.streamId);
      
      const [deletedPermission] = await db
        .delete(permissions)
        .where(and(
          eq(permissions.userId, userId),
          eq(permissions.streamId, streamId)
        ))
        .returning();

      if (!deletedPermission) {
        return res.status(404).send("Permission not found");
      }

      res.json(deletedPermission);
    } catch (error) {
      console.error('Error deleting permission:', error);
      res.status(500).send("Failed to delete permission");
    }
  });

  const httpServer = createServer(app);

  // Setup WebSocket server for real-time updates
  // Traffic stats routes
  app.get("/api/streams/:streamId/traffic", requireAuth, async (req, res) => {
    try {
      const streamId = parseInt(req.params.streamId);
      const monthsToShow = 6; // Show last 6 months
      
      // Calculate date range
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth() - monthsToShow + 1, 1);
      
      const stats = await db
        .select({
          year: trafficStats.year,
          month: trafficStats.month,
          bytesIn: trafficStats.bytesIn,
          bytesOut: trafficStats.bytesOut,
          lastUpdated: trafficStats.lastUpdated,
        })
        .from(trafficStats)
        .where(and(
          eq(trafficStats.streamId, streamId),
          sql`(${trafficStats.year} * 100 + ${trafficStats.month}) >= ${startDate.getFullYear() * 100 + startDate.getMonth() + 1}`
        ))
        .orderBy(sql`${trafficStats.year} * 100 + ${trafficStats.month}`);

      // Convert BigInt to Number for JSON serialization
      const formattedStats = stats.map(stat => ({
        ...stat,
        bytesIn: Number(stat.bytesIn),
        bytesOut: Number(stat.bytesOut),
      }));
      
      res.json(formattedStats);
    } catch (error) {
      console.error('Error fetching traffic stats:', error);
      res.status(500).send("Failed to fetch traffic stats");
    }
  });

  // Update traffic stats (called periodically by the server)
  async function updateTrafficStats(stream: typeof streams.$inferSelect) {
    if (!stream.streamStatus) return;
    
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    
    const [existingStat] = await db
      .select()
      .from(trafficStats)
      .where(and(
        eq(trafficStats.streamId, stream.id),
        eq(trafficStats.year, year),
        eq(trafficStats.month, month)
      ))
      .limit(1);
    
    if (existingStat) {
      await db
        .update(trafficStats)
        .set({
          bytesIn: BigInt(stream.streamStatus.stats.bytes_in),
          bytesOut: BigInt(stream.streamStatus.stats.bytes_out),
          lastUpdated: now,
        })
        .where(eq(trafficStats.id, existingStat.id));
    } else {
      await db
        .insert(trafficStats)
        .values({
          streamId: stream.id,
          year,
          month,
          bytesIn: BigInt(stream.streamStatus.stats.bytes_in),
          bytesOut: BigInt(stream.streamStatus.stats.bytes_out),
        });
    }
  }

  setupWebSocket(httpServer);

  return httpServer;
}