import { servers } from "@db/schema";
import { db } from "@db";
import { eq } from "drizzle-orm";
import https from 'node:https';

interface FlussonicError {
  error: string;
  description?: string;
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

interface FlussonicStream {
  name: string;
  alive: boolean;
  clients: number;
  bytes_in?: number;
  input?: {
    bitrate?: number;
    time?: number;
  };
}

interface FlussonicStreamsResponse {
  streams: FlussonicStream[];
}

export class FlussonicService {
  private async makeRequest(url: string, options: RequestInit & { rejectUnauthorized?: boolean } = {}) {
    const { rejectUnauthorized = true, ...fetchOptions } = options;
    
    if (process.env.NODE_ENV === 'development') {
      // In development, create a custom HTTPS agent that can handle self-signed certs
      const httpsAgent = new https.Agent({ rejectUnauthorized });
      return fetch(url, {
        ...fetchOptions,
        //@ts-ignore - the agent property is actually supported by node-fetch
        agent: url.startsWith('https:') ? httpsAgent : undefined,
      });
    }
    
    return fetch(url, fetchOptions);
  }

  async validateAuth(server: typeof servers.$inferSelect): Promise<boolean> {
    try {
      // Test authentication using the streams endpoint
      const serverUrl = new URL(server.url);
      const apiUrl = new URL('/streamer/api/v3/streams', serverUrl).toString();
      
      console.log(`Testing authentication with Flussonic server at: ${apiUrl}`);
      
      const basicAuth = Buffer.from(`${server.username}:${server.password}`).toString('base64');
      const response = await this.makeRequest(apiUrl, {
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Accept': 'application/json',
        },
        rejectUnauthorized: process.env.NODE_ENV !== 'development'
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        let detailedError = '';
        
        try {
          const errorText = await response.text();
          if (errorText) {
            try {
              const error = JSON.parse(errorText) as FlussonicError;
              errorMessage = error.description || error.error || errorText;
            } catch {
              errorMessage = errorText;
            }
          }
        } catch (e) {
          errorMessage = response.statusText;
        }

        // Add more context to common errors
        if (response.status === 404) {
          detailedError = `Flussonic API not found at ${server.url}. This could mean:
1. The server URL is incorrect
2. The API endpoint is not enabled
3. The server is not running`;
        } else if (response.status === 401) {
          detailedError = 'Invalid username or password. Please verify your credentials.';
        } else if (response.status === 403) {
          detailedError = 'Access forbidden. The provided credentials do not have sufficient permissions.';
        } else if (response.status >= 500) {
          detailedError = 'The Flussonic server encountered an internal error. Please check the server logs.';
        }

        throw new Error(detailedError || `Flussonic authentication failed: ${errorMessage}`);
      }

      return true;
    } catch (error: any) {
      console.error(`Failed to authenticate with Flussonic server ${server.name}:`, error);
      await db
        .update(servers)
        .set({ 
          lastError: error.message,
          lastErrorAt: new Date(),
        })
        .where(eq(servers.id, server.id));
      throw error;
    }
  }

  async makeAuthenticatedRequest<T extends FlussonicSystemStats | FlussonicStreamsResponse>(
    server: typeof servers.$inferSelect,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    try {
      // Parse and validate the server URL
      const serverUrl = new URL(server.url);
      
      // Construct the API URL - use the base URL and append the API path
      const apiPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
      const apiUrl = new URL(`/streamer/api/v3${apiPath}`, serverUrl).toString();
      
      console.log(`Making request to Flussonic API: ${apiUrl}`);
      
      const basicAuth = Buffer.from(`${server.username}:${server.password}`).toString('base64');
      const response = await this.makeRequest(apiUrl, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Basic ${basicAuth}`,
          'Accept': 'application/json',
        },
        rejectUnauthorized: process.env.NODE_ENV !== 'development'
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorText = await response.text();
          if (errorText) {
            try {
              const error = JSON.parse(errorText) as FlussonicError;
              errorMessage = error.description || error.error || errorText;
            } catch {
              errorMessage = errorText;
            }
          }
        } catch (e) {
          errorMessage = response.statusText;
        }

        if (response.status === 404) {
          throw new Error(`API endpoint not found: ${endpoint}`);
        } else if (response.status === 401) {
          throw new Error('Invalid username or password');
        }
        
        throw new Error(`Flussonic API error (${response.status}): ${errorMessage}`);
      }

      const data = await response.json();
      return data as T;
    } catch (error: any) {
      console.error(`Failed to make request to ${endpoint}:`, error);
      // Update server status
      await db
        .update(servers)
        .set({ 
          lastError: error.message,
          lastErrorAt: new Date(),
        })
        .where(eq(servers.id, server.id));
      throw error;
    }
  }
}

export const flussonicService = new FlussonicService();
