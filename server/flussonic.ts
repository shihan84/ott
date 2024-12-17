import { servers, streams } from "@db/schema";
import { db } from "@db";
import { eq } from "drizzle-orm";
import type { StreamStats } from "../client/src/types";

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

async function fetchServerStats(server: typeof servers.$inferSelect) {
  try {
    const [streamsResponse, systemResponse] = await Promise.all([
      fetch(`${server.url}/flussonic/api/streams`, {
        headers: {
          Authorization: `Bearer ${server.apiKey}`,
        },
      }),
      fetch(`${server.url}/flussonic/api/system`, {
        headers: {
          Authorization: `Bearer ${server.apiKey}`,
        },
      }),
    ]);

    if (!streamsResponse.ok || !systemResponse.ok) {
      throw new Error(`Flussonic API error: ${streamsResponse.statusText || systemResponse.statusText}`);
    }

    const [streamsData, systemData] = await Promise.all([
      streamsResponse.json(),
      systemResponse.json(),
    ]);

    return {
      streams: streamsData.streams as FlussonicStreamStats[],
      system: systemData as FlussonicServerStats['system'],
    };
  } catch (error) {
    console.error(`Error fetching stats from server ${server.name}:`, error);
    return { streams: [], system: { cpu_usage: 0, memory_usage: 0, uptime: 0 } };
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
