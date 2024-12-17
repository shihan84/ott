import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { streams, servers } from "@db/schema";
import { db } from "@db";
import { eq } from "drizzle-orm";

const THUMBNAIL_DIR = path.join(process.cwd(), 'public', 'thumbnails');

// Ensure thumbnail directory exists
async function ensureThumbnailDir() {
  try {
    await fs.mkdir(THUMBNAIL_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating thumbnail directory:', error);
  }
}

export class ThumbnailService {
  static async generateThumbnail(streamUrl: string, streamId: number): Promise<string | null> {
    try {
      await ensureThumbnailDir();
      
      const thumbnailPath = path.join(THUMBNAIL_DIR, `${streamId}.jpg`);
      
      return new Promise((resolve, reject) => {
        // Use FFmpeg to capture a frame from the stream
        const ffmpeg = spawn('ffmpeg', [
          '-y',
          '-i', streamUrl,
          '-vframes', '1',
          '-vf', 'scale=320:-1',
          '-q:v', '2',
          thumbnailPath
        ]);

        let error = '';
        
        ffmpeg.stderr.on('data', (data) => {
          error += data.toString();
        });

        ffmpeg.on('close', async (code) => {
          if (code !== 0) {
            console.error('FFmpeg error:', error);
            reject(new Error(`FFmpeg exited with code ${code}`));
            return;
          }

          try {
            // Update stream record with thumbnail path
            await db
              .update(streams)
              .set({ thumbnailPath: `/thumbnails/${streamId}.jpg` })
              .where(eq(streams.id, streamId));

            resolve(`/thumbnails/${streamId}.jpg`);
          } catch (error) {
            console.error('Error updating stream record:', error);
            reject(error);
          }
        });
      });
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      return null;
    }
  }

  static async updateAllThumbnails() {
    try {
      const allStreams = await db.select().from(streams);
      
      for (const stream of allStreams) {
        if (stream.streamStatus?.stats.alive) {
          try {
            // Get the server details to construct proper URL
            const [server] = await db
              .select()
              .from(servers)
              .where(eq(servers.id, stream.serverId))
              .limit(1);
            
            if (server) {
              const serverUrl = new URL(server.url);
              const streamUrl = `${serverUrl.protocol}//${serverUrl.host}/${stream.streamKey}/index.m3u8`;
              console.log(`Generating thumbnail for stream ${stream.id} from URL: ${streamUrl}`);
              await this.generateThumbnail(streamUrl, stream.id);
            }
          } catch (error) {
            console.error(`Error generating thumbnail for stream ${stream.id}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error updating thumbnails:', error);
    }
  }
}

// Start periodic thumbnail updates
setInterval(() => {
  ThumbnailService.updateAllThumbnails();
}, 5 * 60 * 1000); // Update every 5 minutes
