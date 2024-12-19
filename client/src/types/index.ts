import type { Stream, Server, User, Permission } from "@db/schema";

// Matches Flussonic API spec from OpenAPI docs
export interface MediaTrack {
  content: string;
  codec: string;
  bitrate?: number;
  width?: number;
  height?: number;
  fps?: number;
  profile?: string;
  level?: string;
  channels?: number;
  sample_rate?: number;
}

interface MediaInfo {
  tracks: MediaTrack[];
}

interface PushStats {
  id: string;
  status: string;
  bytes: number;
  payload: number;
  opened_at: number;
  fillers: number;
  stuffing: number;
  trimmed_bytes: number;
  trimmed_frames: number;
  encoded: number;
  retries: number;
  sys_fillers: number;
  sys_payload: number;
  sys_stuffing: number;
}

interface Push {
  stats: PushStats;
  url: string;
}

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
    opened_at: number;
    media_info?: MediaInfo;
  };
  template?: string;
  static: boolean;
  nomedia: boolean;
  pushes?: Push[];
}

export interface StreamWithStats extends Stream {
  streamStatus: StreamStats | null;
  server?: {
    url: string;
  };
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
