import { servers, streams } from "@db/schema";
import { db } from "@db";
import { eq } from "drizzle-orm";
import type { StreamStats } from "../client/src/types";
import { flussonicService } from "./services/flussonic";

// Flussonic API response types
// Interface reflecting the OpenAPI spec
export interface FlussonicStreamsResponse {
  streams: FlussonicStream[];
}

interface FlussonicStreamInput {
  bitrate: number;
  bytes_in: number;
  time: number;
}

interface FlussonicStream {
  name: string;
  alive: boolean;
  input?: FlussonicStreamInput;
  clients: number;
}

interface FlussonicSystemStats {
  cpu: {
    total: number;
    user: number;
    system: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
  };
  uptime: number;
}

// Our normalized types
interface FlussonicStreamStats {
  name: string;
  input: {
    connected: boolean;
    bitrate: number;
  };
  clients: number;
  bandwidth_in: number;
  uptime: number;
}

interface FlussonicServerStats {
  streams: FlussonicStreamStats[];
  system: {
    cpu_usage: number;
    memory_usage: number;
    uptime: number;
  };
}

export async function setupFlussonicIntegration() {
  // Poll Flussonic servers every 30 seconds
  setInterval(async () => {
    try {
      const allServers = await db.select().from(servers);
      
      for (const server of allServers) {
        const stats = await fetchServerStats(server);
        await updateStreamStats(server.id, stats);
      }
    } catch (error) {
      console.error("Error polling Flussonic servers:", error);
    }
  }, 30000);
}

async function fetchServerStats(server: typeof servers.$inferSelect): Promise<FlussonicStreamStats[]> {
  try {
    const streamsData = await flussonicService.makeAuthenticatedRequest<FlussonicStreamsResponse>(
      server,
      '/streams'
    );

    // Map Flussonic API response to our expected format
    // Only include streams that are alive and have valid input
    return streamsData.streams
      .filter(stream => stream.alive && stream.input)
      .map(stream => ({
        name: stream.name,
        input: {
          connected: true, // We already filtered for alive streams
          bitrate: stream.input!.bitrate || 0,
        },
        clients: stream.clients || 0,
        bandwidth_in: stream.input!.bytes_in || 0,
        uptime: stream.input!.time || 0,
      }));
  } catch (error) {
    console.error(`Error fetching stats from server ${server.name}:`, error);
    return [];
  }
}

async function updateStreamStats(serverId: number, flussonicStats: FlussonicStreamStats[]) {
  const serverStreams = await db
    .select()
    .from(streams)
    .where(eq(streams.serverId, serverId));

  for (const stream of serverStreams) {
    const flussonicStream = flussonicStats.find(s => s.name === stream.streamKey);
    
    if (flussonicStream) {
      const stats: StreamStats = {
        viewers: flussonicStream.clients,
        bandwidth: flussonicStream.bandwidth_in,
        status: flussonicStream.input.connected ? 'online' : 'offline',
        uptime: flussonicStream.uptime,
        bitrate: flussonicStream.input.bitrate,
      };

      await db
        .update(streams)
        .set({ stats })
        .where(eq(streams.id, stream.id));
    } else {
      // Stream not found in Flussonic, mark as offline
      await db
        .update(streams)
        .set({
          stats: {
            viewers: 0,
            bandwidth: 0,
            status: 'offline',
            uptime: 0,
            bitrate: 0,
          },
        })
        .where(eq(streams.id, stream.id));
    }
  }
}
