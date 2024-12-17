import type { Stream, Server, User, Permission } from "@db/schema";

// Matches Flussonic API spec from OpenAPI docs
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

export interface StreamWithStats extends Stream {
  streamStatus: StreamStats | null;
}

export interface UserWithPermissions extends User {
  permissions: Permission[];
}

export interface ServerWithStreams extends Server {
  streams: StreamWithStats[];
}

export interface WSMessage {
  type: 'stats' | 'status';
  streamId: number;
  data: StreamStats;
}
