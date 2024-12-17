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
      
      const response = await fetch(`${server.url}/flussonic/api/v3/auth`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        // Add additional required parameters if needed by your Flussonic version
        body: JSON.stringify({
          scope: 'streams media_info dvr',  // Request specific access scopes
        }),
      });

      if (!response.ok) {
        const error = await response.json() as FlussonicError;
        if (response.status === 401) {
          throw new Error('Invalid API key or unauthorized access');
        }
        throw new Error(`Flussonic authentication failed: ${error.description || error.error}`);
      }

      const { token, expires } = await response.json() as AuthResponse;
      
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
        
        const response = await fetch(fullUrl, {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage: string;
          
          try {
            const errorJson = JSON.parse(errorText) as FlussonicError;
            errorMessage = errorJson.description || errorJson.error;
          } catch {
            errorMessage = errorText;
          }

          if (response.status === 401) {
            if (attempt < maxRetries - 1) {
              // Token expired, clear it and retry
              console.log('Token expired, attempting to refresh...');
              this.authTokens.delete(server.id);
              attempt++;
              continue;
            }
          }
          
          throw new Error(`Flussonic API error (${response.status}): ${errorMessage}`);
        }

        return response.json();
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
