import { servers } from "@db/schema";
import { db } from "@db";
import { eq } from "drizzle-orm";
import https from 'node:https';
import { openAPIValidator } from './openapi-validator';

interface FlussonicError {
  id?: string;
  status?: string;
  code?: string;
  title?: string;
  source?: {
    pointer?: string;
    parameter?: string;
  };
  meta?: Record<string, string>;
}

// API types based on Flussonic Media Server OpenAPI spec
interface FlussonicStats {
  alive: boolean;
  status: string;
  bytes_in: number;
  bytes_out: number;
  input_bitrate: number;
  online_clients: number;
  last_access_at: number;
  last_dts: number;
}

export interface FlussonicStream {
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

interface FlussonicStreamsResponse {
  streams: FlussonicStream[];
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

export class FlussonicService {
  async getStreams(server: typeof servers.$inferSelect): Promise<FlussonicStream[]> {
    try {
      console.log(`Fetching streams for server ${server.name} from ${server.url}`);
      
      // Call the Flussonic API endpoint as per OpenAPI spec
      const response = await this.makeAuthenticatedRequest<FlussonicStreamsResponse>(
        server,
        '/streamer/api/v3/streams',
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        },
        false // Disable schema validation temporarily for debugging
      );
      
      console.log('Raw Flussonic API response:', JSON.stringify(response, null, 2));
      
      console.log('Raw Flussonic API response:', JSON.stringify(response, null, 2));
      
      if (!response) {
        console.warn('Empty response from Flussonic API');
        return [];
      }

      if (!response.streams || !Array.isArray(response.streams)) {
        console.warn('Invalid streams array in response:', response);
        return [];
      }

      // Map response to our FlussonicStream type
      const streams = response.streams.map(stream => {
        // Log individual stream data for debugging
        console.log('Processing stream:', JSON.stringify(stream, null, 2));
        
        return {
          name: stream.name,
          stats: {
            alive: stream.stats?.alive || false,
            status: stream.stats?.status || 'unknown',
            bytes_in: stream.stats?.bytes_in || 0,
            bytes_out: stream.stats?.bytes_out || 0,
            input_bitrate: stream.stats?.input_bitrate || 0,
            online_clients: stream.stats?.online_clients || 0,
            last_access_at: stream.stats?.last_access_at || 0,
            last_dts: stream.stats?.last_dts || Math.floor(Date.now() / 1000)
          },
          template: stream.template,
          static: stream.static || false,
          nomedia: stream.nomedia || false
        };
      });

      console.log(`Successfully processed ${streams.length} streams from ${server.name}`);
      return streams;
    } catch (error) {
      console.error(`Error fetching streams from ${server.name}:`, error);
      // Log the full error stack for debugging
      if (error instanceof Error) {
        console.error('Error stack:', error.stack);
      }
      throw error;
    }
  }

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
        try {
          const errorText = await response.text();
          if (errorText) {
            try {
              const error = JSON.parse(errorText) as FlussonicError;
              errorMessage = error.title || errorText;
            } catch {
              errorMessage = errorText;
            }
          }
        } catch (e) {
          errorMessage = response.statusText;
        }

        if (response.status === 404) {
          throw new Error(`Flussonic API not found at ${server.url}. Please check the server URL.`);
        } else if (response.status === 401) {
          throw new Error('Invalid username or password');
        }
        throw new Error(`Flussonic authentication failed: ${errorMessage}`);
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

  async addPushDestination(
    server: typeof servers.$inferSelect,
    streamKey: string,
    pushUrl: string
  ): Promise<void> {
    try {
      console.log(`Adding push destination for stream ${streamKey} to ${pushUrl}`);
      
      // Call Flussonic API to add push destination
      await this.makeAuthenticatedRequest(
        server,
        `/streamer/api/v3/stream/${streamKey}/push`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            url: pushUrl,
            enabled: true,
            backup: false
          })
        }
      );
      
      console.log('Push destination added successfully');
    } catch (error) {
      console.error(`Failed to add push destination for stream ${streamKey}:`, error);
      throw error;
    }
  }

  async removePushDestination(
    server: typeof servers.$inferSelect,
    streamKey: string,
    pushUrl: string
  ): Promise<void> {
    try {
      console.log(`Removing push destination for stream ${streamKey}: ${pushUrl}`);
      
      // Call Flussonic API to remove push destination
      await this.makeAuthenticatedRequest(
        server,
        `/streamer/api/v3/stream/${streamKey}/push/${encodeURIComponent(pushUrl)}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Push destination removed successfully');
    } catch (error) {
      console.error(`Failed to remove push destination for stream ${streamKey}:`, error);
      throw error;
    }
  }

  async makeAuthenticatedRequest<T>(
    server: typeof servers.$inferSelect,
    endpoint: string,
    options: RequestInit = {},
    validateSchema: boolean = true
  ): Promise<T> {
    console.log('Making authenticated request to Flussonic API:', {
      url: new URL(endpoint, server.url).toString(),
      method: options.method || 'GET',
      body: options.body ? JSON.parse(options.body as string) : undefined,
      validateSchema
    });
    try {
      // Parse and validate the server URL
      const serverUrl = new URL(server.url);
      serverUrl.pathname = ''; // Clear any existing path
      
      // Construct the API URL - endpoint should contain the full API path
      const apiPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
      const apiUrl = new URL(apiPath, serverUrl).toString();
      
      console.log(`Making authenticated request to Flussonic API:`, {
        url: apiUrl,
        method: options.method || 'GET',
        validateSchema
      });
      
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
        let errorDetails = null;
        
        try {
          const errorText = await response.text();
          console.log('Error response text:', errorText);
          
          if (errorText) {
            try {
              errorDetails = JSON.parse(errorText);
              errorMessage = errorDetails.title || errorDetails.message || errorText;
            } catch {
              errorMessage = errorText;
            }
          }
        } catch (e) {
          console.error('Failed to parse error response:', e);
          errorMessage = response.statusText;
        }

        if (response.status === 404) {
          throw new Error(`API endpoint not found: ${endpoint} (${errorMessage})`);
        } else if (response.status === 401) {
          throw new Error(`Authentication failed: ${errorMessage}`);
        }
        
        throw new Error(`Flussonic API error (${response.status}): ${errorMessage}`);
      }

      const data = await response.json();
      console.log('Received response data:', JSON.stringify(data, null, 2));
      
      // Validate response against OpenAPI spec if requested
      if (validateSchema) {
        console.log('Validating response against OpenAPI spec...');
        const errors = openAPIValidator.validateResponse(endpoint, options.method || 'GET', response.status, data);
        if (errors.length > 0) {
          console.warn('Response validation warnings:', errors);
          // In development, continue despite validation errors
          if (process.env.NODE_ENV === 'development') {
            console.log('Continuing despite validation errors in development mode');
          } else {
            throw new Error(`API response does not match OpenAPI spec: ${errors[0].message}`);
          }
        }
      }
      
      return data as T;
    } catch (error: any) {
      console.error(`Failed to make request to ${endpoint}:`, error);
      if (error instanceof Error) {
        console.error('Error stack:', error.stack);
      }
      
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

// Stream statistics tracking
export class StreamStatisticsService {
  static async getServerStreams(server: typeof servers.$inferSelect): Promise<FlussonicStreamsResponse> {
    console.log('Fetching streams from server:', server.name);
    
    try {
      const response = await flussonicService.makeAuthenticatedRequest<FlussonicStreamsResponse>(
        server,
        '/streamer/api/v3/streams',
        { 
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        },
        true // Enable schema validation
      );
      
      console.log('Received streams response:', response);
      return response;
    } catch (error) {
      console.error('Error fetching streams:', error);
      throw error;
    }
  }

  static async getActiveStreams(server: typeof servers.$inferSelect): Promise<FlussonicStream[]> {
    try {
      console.log('Getting active streams for server:', server.name);
      const response = await this.getServerStreams(server);
      
      if (!response.streams) {
        console.warn('No streams array in response');
        return [];
      }
      
      const activeStreams = response.streams.filter(stream => stream.stats.alive);
      console.log('Found active streams:', activeStreams.length);
      return activeStreams;
    } catch (error) {
      console.error(`Failed to get active streams for server ${server.name}:`, error);
      return [];
    }
  }

  static normalizeStreamStats(stream: FlussonicStream): FlussonicStream {
    return {
      name: stream.name,
      stats: {
        alive: stream.stats.alive,
        status: stream.stats.status,
        bytes_in: stream.stats.bytes_in,
        bytes_out: stream.stats.bytes_out,
        input_bitrate: stream.stats.input_bitrate,
        online_clients: stream.stats.online_clients,
        last_access_at: stream.stats.last_access_at,
        last_dts: stream.stats.last_dts
      },
      template: stream.template,
      static: stream.static,
      nomedia: stream.nomedia
    };
  }
}