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
interface FlussonicInputStream {
  bitrate: number;
  bytes_in: number;
  time: number;
}

interface FlussonicStream {
  name: string;
  alive: boolean;
  input?: FlussonicInputStream;
  clients: number;
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

  async makeAuthenticatedRequest<T>(
    server: typeof servers.$inferSelect,
    endpoint: string,
    options: RequestInit = {},
    validateSchema: boolean = true
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
              errorMessage = error.title || errorText;
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
      
      // Validate response against OpenAPI spec if requested
      if (validateSchema) {
        const errors = openAPIValidator.validateResponse(endpoint, options.method || 'GET', response.status, data);
        if (errors.length > 0) {
          console.error('Response validation errors:', errors);
          throw new Error(`API response does not match OpenAPI spec: ${errors[0].message}`);
        }
      }
      
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
