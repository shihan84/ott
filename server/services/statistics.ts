import { db } from "@db";
import { servers } from "@db/schema";
import { flussonicService } from "./flussonic";
import type { FlussonicStream } from "./flussonic";

interface ServerStatistics {
  serverId: number;
  serverName: string;
  totalBandwidth: number;
  activeStreams: number;
  cpuUsage: number;
  memoryUsage: number;
  streamHealth: {
    healthy: number;
    warning: number;
    error: number;
  };
  timestamp: Date;
}

export class StatisticsService {
  async getAggregatedStats(): Promise<ServerStatistics[]> {
    try {
      const allServers = await db.select().from(servers);
      const stats: ServerStatistics[] = [];

      for (const server of allServers) {
        try {
          const streams = await flussonicService.getStreams(server);
          
          // Calculate stream health statistics
          const streamHealth = this.calculateStreamHealth(streams);
          
          // Calculate total bandwidth
          const totalBandwidth = streams.reduce((sum, stream) => 
            sum + (stream.stats?.input_bitrate || 0), 0);

          stats.push({
            serverId: server.id,
            serverName: server.name,
            totalBandwidth,
            activeStreams: streams.filter(s => s.stats.alive).length,
            cpuUsage: this.calculateCPUUsage(streams),
            memoryUsage: this.calculateMemoryUsage(streams),
            streamHealth,
            timestamp: new Date()
          });
        } catch (error) {
          console.error(`Failed to get statistics for server ${server.name}:`, error);
        }
      }

      return stats;
    } catch (error) {
      console.error('Failed to get aggregated statistics:', error);
      throw error;
    }
  }

  private calculateStreamHealth(streams: FlussonicStream[]) {
    return streams.reduce((acc, stream) => {
      if (!stream.stats?.alive) {
        acc.error++;
      } else if (stream.stats.input_bitrate === 0) {
        acc.warning++;
      } else {
        acc.healthy++;
      }
      return acc;
    }, { healthy: 0, warning: 0, error: 0 });
  }

  private calculateCPUUsage(streams: FlussonicStream[]): number {
    // Estimate CPU usage based on number of active streams and their bitrates
    const activeStreams = streams.filter(s => s.stats.alive);
    const totalBitrate = activeStreams.reduce((sum, stream) => 
      sum + (stream.stats?.input_bitrate || 0), 0);
    
    // Basic estimation: 1% per active stream plus 0.1% per 1mbps of bitrate
    const baseLoad = activeStreams.length * 1;
    const bitrateLoad = (totalBitrate / 1000000) * 0.1;
    
    return Math.min(100, baseLoad + bitrateLoad);
  }

  private calculateMemoryUsage(streams: FlussonicStream[]): number {
    // Estimate memory usage based on number of active streams
    const activeStreams = streams.filter(s => s.stats.alive);
    
    // Basic estimation: 50MB base + 10MB per active stream
    const baseMemory = 50;
    const streamMemory = activeStreams.length * 10;
    const totalMemoryMB = baseMemory + streamMemory;
    
    // Convert to percentage assuming 8GB total memory
    const totalSystemMemoryMB = 8 * 1024;
    return Math.min(100, (totalMemoryMB / totalSystemMemoryMB) * 100);
  }
}

export const statisticsService = new StatisticsService();
