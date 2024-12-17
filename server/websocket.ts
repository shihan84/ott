import { WebSocketServer } from "ws";
import type { Server } from "http";
import { streams } from "@db/schema";
import { db } from "@db";
import type { WSMessage } from "../client/src/types";

// Import the updateTrafficStats function from routes
let updateTrafficStats: any;
export function setTrafficStatsUpdater(updater: any) {
  updateTrafficStats = updater;
}

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ 
    server,
    verifyClient: (info: any) => {
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
      if (stream.streamStatus) {
        const message: WSMessage = {
          type: 'stats',
          streamId: stream.id,
          data: stream.streamStatus,
        };
        
        ws.send(JSON.stringify(message));
        
        // Update traffic stats for this stream
        if (updateTrafficStats) {
          await updateTrafficStats(stream).catch(console.error);
        }
      }
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
      if (stream.streamStatus) {
        const message: WSMessage = {
          type: 'stats',
          streamId: stream.id,
          data: stream.streamStatus,
        };
        
        const messageStr = JSON.stringify(message);
        
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(messageStr);
          }
        });
        
        // Update traffic stats for this stream
        if (updateTrafficStats) {
          await updateTrafficStats(stream).catch(console.error);
        }
      }
    }
  } catch (error) {
    console.error("Error broadcasting stats:", error);
  }
}
