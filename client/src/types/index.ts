import type { Stream, Server, User, Permission } from "@db/schema";

export interface StreamStats {
  name: string;
  isActive: boolean;
  bitrate: number;
  bytesIn: number;
  activeViewers: number;
  uptime: number;
}

export interface StreamWithStats extends Omit<Stream, 'streamStatus'> {
  streamStatus: StreamStats | null;
  server: Server;
}

export interface UserWithPermissions extends User {
  permissions: Permission[];
}

export interface ServerWithStreams extends Server {
  streams: Stream[];
}

export interface WSMessage {
  type: 'stats' | 'status';
  streamId: number;
  data: StreamStats;
}
