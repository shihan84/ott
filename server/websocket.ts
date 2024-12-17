import { WebSocketServer } from "ws";
import type { Server } from "http";
import { streams } from "@db/schema";
import { db } from "@db";
import type { WSMessage } from "../client/src/types";

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ 
    server,
    verifyClient: (info: { req: { headers: { [key: string]: string | undefined } } }) => {
      // Ignore Vite HMR WebSocket connections
      const protocol = info.req.headers['sec-websocket-protocol'];
      return protocol !== 'vite-hmr';
    }
  });

  wss.on("connection", (ws) => {
    console.log("WebSocket client connected");

    // Send initial stream stats
    sendInitialStats(ws);

    ws.on("error", console.error);

    ws.on("close", () => {
      console.log("WebSocket client disconnected");
    });
  });

  // Setup periodic stats broadcast
  setInterval(() => {
    broadcastStats(wss);
  }, 5000);

  return wss;
}

async function sendInitialStats(ws: import('ws').WebSocket) {
  try {
    const allStreams = await db.select().from(streams);
    
    for (const stream of allStreams) {
      const message: WSMessage = {
        type: 'stats',
        streamId: stream.id,
        data: stream.stats as any,
      };
      
      ws.send(JSON.stringify(message));
    }
  } catch (error) {
    console.error("Error sending initial stats:", error);
  }
}

async function broadcastStats(wss: WebSocketServer) {
  if (wss.clients.size === 0) return;

  try {
    const allStreams = await db.select().from(streams);
    
    for (const stream of allStreams) {
      const message: WSMessage = {
        type: 'stats',
        streamId: stream.id,
        data: stream.stats as any,
      };
      
      const messageStr = JSON.stringify(message);
      
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(messageStr);
        }
      });
    }
  } catch (error) {
    console.error("Error broadcasting stats:", error);
  }
}
