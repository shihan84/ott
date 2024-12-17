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
  private authTokens: Map<number, { token: string; expires: number }> = new Map();

  async authenticate(server: typeof servers.$inferSelect): Promise<string> {
    const cachedAuth = this.authTokens.get(server.id);
    if (cachedAuth && cachedAuth.expires > Date.now()) {
      return cachedAuth.token;
    }

    try {
      // Flussonic uses Basic Auth with username and password
      const basicAuth = Buffer.from(`${server.username}:${server.password}`).toString('base64');
      
      // Ensure URL is properly formatted and handle SSL
      const apiUrl = new URL('/flussonic/api/v3/sessions', server.url).toString();
      console.log(`Attempting to authenticate with Flussonic server at: ${apiUrl}`);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Accept': 'application/json',
        },
        // Allow self-signed certificates in development
        agent: process.env.NODE_ENV === 'development' ? 
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

      let responseData: AuthResponse;
      try {
        responseData = await response.json();
      } catch (e) {
        throw new Error('Invalid response from Flussonic server');
      }

      const { token, expires } = responseData;
      
      // Store the token with expiration (convert to milliseconds)
      const expirationTime = Date.now() + (expires * 1000);
      this.authTokens.set(server.id, {
        token,
        expires: expirationTime,
      });

      // Log successful authentication
      console.log(`Successfully authenticated with Flussonic server ${server.name}, token expires in ${expires} seconds`);

      return token;
    } catch (error) {
      console.error(`Failed to authenticate with Flussonic server ${server.name}:`, error);
      // Update server status in database to reflect authentication failure
      await db
        .update(servers)
        .set({ lastError: error.message })
        .where(eq(servers.id, server.id));
      throw error;
    }
  }

  async validateToken(serverId: number): Promise<boolean> {
    const auth = this.authTokens.get(serverId);
    if (!auth) return false;
    return auth.expires > Date.now();
  }

  async makeAuthenticatedRequest<T>(
    server: typeof servers.$inferSelect,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const maxRetries = 2;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const token = await this.authenticate(server);
        const fullUrl = `${server.url}/flussonic/api/v3${endpoint}`;
        
        console.log(`Making request to Flussonic API: ${fullUrl}`);
        
        // Ensure URL is properly formatted and handle SSL
        const apiUrl = new URL(`/flussonic/api${endpoint}`, server.url).toString();
        console.log(`Making request to Flussonic API: ${apiUrl}`);
        
        const response = await fetch(apiUrl, {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': `Basic ${Buffer.from(`${server.username}:${server.password}`).toString('base64')}`,
            'Accept': 'application/json',
          },
          // Allow self-signed certificates in development
          agent: process.env.NODE_ENV === 'development' ? 
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
            if (attempt < maxRetries - 1) {
              // Auth failed, retry
              console.log('Authentication failed, retrying...');
              attempt++;
              continue;
            }
            throw new Error('Authentication failed');
          }
          
          throw new Error(`Flussonic API error (${response.status}): ${errorMessage}`);
        }

        let responseData: T;
        try {
          responseData = await response.json();
        } catch (e) {
          throw new Error('Invalid JSON response from Flussonic server');
        }

        return responseData;
      } catch (error) {
        if (attempt === maxRetries - 1) {
          console.error(`Failed to make authenticated request to ${endpoint} after ${maxRetries} attempts:`, error);
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
        attempt++;
      }
    }

    throw new Error('Maximum retry attempts reached');
  }
}

export const flussonicService = new FlussonicService();
