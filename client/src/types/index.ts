export interface StreamStats {
  viewers: number;
  bandwidth: number;
  status: 'online' | 'offline';
  uptime: number;
  bitrate: number;
}

export interface StreamWithStats extends Stream {
  stats: StreamStats;
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
