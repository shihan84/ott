import type { Agent } from 'node:https';
import { servers } from "@db/schema";
import { db } from "@db";
import { eq } from "drizzle-orm";

interface AuthResponse {
  token: string;
  expires: number;
}

interface FlussonicError {
  error: string;
  description?: string;
}

export class FlussonicService {
  async validateAuth(server: typeof servers.$inferSelect): Promise<boolean> {
    try {
      // Test authentication using the streams endpoint
      const serverUrl = new URL(server.url);
      const apiUrl = new URL('/streamer/api/v3/streams', serverUrl).toString();
      
      console.log(`Testing authentication with Flussonic server at: ${apiUrl}`);
      
      const basicAuth = Buffer.from(`${server.username}:${server.password}`).toString('base64');
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Accept': 'application/json',
        },
        agent: process.env.NODE_ENV === 'development' && serverUrl.protocol === 'https:' ? 
          new (await import('node:https')).Agent({
            rejectUnauthorized: false
          }) : undefined
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
          throw new Error(`Flussonic API not found at ${server.url}. Please check the server URL.`);
        } else if (response.status === 401) {
          throw new Error('Invalid username or password');
        }
        throw new Error(`Flussonic authentication failed: ${errorMessage}`);
      }

      return true;
    } catch (error) {
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
      const response = await fetch(apiUrl, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Basic ${basicAuth}`,
          'Accept': 'application/json',
        },
        // Allow self-signed certificates in development only for HTTPS
        agent: process.env.NODE_ENV === 'development' && serverUrl.protocol === 'https:' ? 
          new (await import('node:https')).Agent({
            rejectUnauthorized: false
          }) : undefined
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

      return response.json();
    } catch (error) {
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
