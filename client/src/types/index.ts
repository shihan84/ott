import type { Stream, Server, User, Permission } from "@db/schema";

// Matches Flussonic API spec from OpenAPI docs
export interface StreamStats {
  name: string;
  stats: {
    alive: boolean;
    status: string;
    bytes_in: number;
    bytes_out: number;
    input_bitrate: number;
    online_clients: number;
    last_access_at: number;
    last_dts: number;
  };
  template?: string;
  static: boolean;
  nomedia: boolean;
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
