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

// No statistics tracking needed
