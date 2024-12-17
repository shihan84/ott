import type { Stream, Server, User, Permission } from "@db/schema";

// Matches Flussonic API spec
export interface StreamStats {
  name: string;
  alive: boolean;
  input?: {
    bitrate: number;
    bytes_in: number;
    time: number;
  };
  clients: number;
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
