import type { Server, User } from '@db/schema';
import type { StreamWithStats } from '../types';

const API_BASE = '/api';

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status >= 500) {
      throw new Error(`Server error (${response.status}): ${errorText}`);
    }
    throw new Error(errorText);
  }

  return response.json();
}

export const api = {
  // Server management
  getServers: () => fetchApi<Server[]>('/servers'),
  createServer: (data: Partial<Server>) =>
    fetchApi<Server>('/servers', { method: 'POST', body: JSON.stringify(data) }),
  deleteServer: (id: number) =>
    fetchApi<void>(`/servers/${id}`, { method: 'DELETE' }),
  testServerConnection: (id: number) =>
    fetchApi<Server>(`/servers/${id}/test`, { method: 'POST' }),

  // Stream management
  getServerStreams: async (serverId: number) => {
    const streams = await fetchApi<StreamWithStats[]>(`/servers/${serverId}/streams`);
    console.log('API Response - Server Streams:', {
      serverId,
      streamsCount: streams.length,
      streamDetails: streams.map(s => ({
        id: s.id,
        name: s.name,
        hasServerUrl: !!s.server?.url,
        serverUrl: s.server?.url
      }))
    });
    return streams;
  },
    
  // User management
  getUsers: () => fetchApi<User[]>('/users'),
  createUser: (data: { username: string; password: string; isAdmin: boolean }) =>
    fetchApi<User>('/users', { method: 'POST', body: JSON.stringify(data) }),
  deleteUser: (id: number) =>
    fetchApi<void>(`/users/${id}`, { method: 'DELETE' }),
  
  // Permission management
  getUserPermissions: (userId: number) => 
    fetchApi<{ streamId: number; userId: number }[]>(`/users/${userId}/permissions`),
  addUserPermission: (userId: number, streamId: number) =>
    fetchApi<void>('/permissions', { method: 'POST', body: JSON.stringify({ userId, streamId }) }),
  removeUserPermission: (userId: number, streamId: number) =>
    fetchApi<void>(`/permissions/${userId}/${streamId}`, { method: 'DELETE' }),
    
  // Traffic stats
  getStreamTraffic: (streamId: number) =>
    fetchApi<Array<{
      year: number;
      month: number;
      bytesIn: number;
      bytesOut: number;
      lastUpdated: string;
    }>>(`/streams/${streamId}/traffic`),
    
  // Get all permitted streams for the current user
  getPermittedStreams: () =>
    fetchApi<StreamWithStats[]>('/streams/permitted'),
    
  // Stream push management
  addStreamPush: (streamId: number, url: string) =>
    fetchApi<void>(`/streams/${streamId}/push`, {
      method: 'POST',
      body: JSON.stringify({ url })
    }),
  
  removeStreamPush: (streamId: number, url: string) =>
    fetchApi<void>(`/streams/${streamId}/push`, {
      method: 'DELETE',
      body: JSON.stringify({ url })
    }),
    
  // Get server health statistics
  getServersHealth: () =>
    fetchApi<Array<{
      serverId: number;
      serverName: string;
      totalBandwidth: number;
      activeStreams: number;
      cpuUsage: number;
      memoryUsage: number;
      streamHealth: {
        healthy: number;
        warning: number;
        error: number;
      };
      timestamp: Date;
    }>>('/api/servers/statistics'),
};
