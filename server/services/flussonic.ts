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
      const auth = Buffer.from(`${server.apiKey}:`).toString('base64');
      const response = await fetch(`${server.url}/api/v3/auth`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json() as FlussonicError;
        throw new Error(`Flussonic authentication failed: ${error.description || error.error}`);
      }

      const { token, expires } = await response.json() as AuthResponse;
      
      // Store the token with expiration
      this.authTokens.set(server.id, {
        token,
        expires: Date.now() + (expires * 1000), // Convert to milliseconds
      });

      return token;
    } catch (error) {
      console.error(`Failed to authenticate with Flussonic server ${server.name}:`, error);
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
    try {
      const token = await this.authenticate(server);
      
      const response = await fetch(`${server.url}/api/v3${endpoint}`, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token might be invalid, clear it and retry once
          this.authTokens.delete(server.id);
          const newToken = await this.authenticate(server);
          
          const retryResponse = await fetch(`${server.url}/api/v3${endpoint}`, {
            ...options,
            headers: {
              ...options.headers,
              'Authorization': `Bearer ${newToken}`,
              'Accept': 'application/json',
            },
          });

          if (!retryResponse.ok) {
            throw new Error(`Request failed after token refresh: ${retryResponse.statusText}`);
          }

          return retryResponse.json();
        }
        
        throw new Error(`Request failed: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error(`Failed to make authenticated request to ${endpoint}:`, error);
      throw error;
    }
  }
}

export const flussonicService = new FlussonicService();
