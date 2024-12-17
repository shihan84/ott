import type { User, Server, Stream, Permission } from '@db/schema';
import type { StreamStats, StreamWithStats } from '../types';

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
    if (response.status >= 500) {
      throw new Error(`${response.status}: ${response.statusText}`);
    }
    throw new Error(await response.text());
  }

  return response.json();
}

export const api = {
  // User management
  getUsers: () => fetchApi<User[]>('/users'),
  createUser: (data: Partial<User>) => 
    fetchApi<User>('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: number, data: Partial<User>) =>
    fetchApi<User>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id: number) =>
    fetchApi<void>(`/users/${id}`, { method: 'DELETE' }),

  // Server management
  getServers: () => fetchApi<Server[]>('/servers'),
  createServer: (data: Partial<Server>) =>
    fetchApi<Server>('/servers', { method: 'POST', body: JSON.stringify(data) }),
  updateServer: (id: number, data: Partial<Server>) =>
    fetchApi<Server>(`/servers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteServer: (id: number) =>
    fetchApi<void>(`/servers/${id}`, { method: 'DELETE' }),
  testServerConnection: (id: number) =>
    fetchApi<{ success: boolean; message: string }>(`/servers/${id}/test`, { method: 'POST' }),

  // Stream management
  getStreams: () => fetchApi<StreamWithStats[]>('/streams'),
  getServerStreams: (serverId: number) => 
    fetchApi<StreamWithStats[]>(`/servers/${serverId}/streams`),
  createStream: (data: Partial<Stream>) =>
    fetchApi<Stream>('/streams', { method: 'POST', body: JSON.stringify(data) }),
  updateStream: (id: number, data: Partial<Stream>) =>
    fetchApi<Stream>(`/streams/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStream: (id: number) =>
    fetchApi<void>(`/streams/${id}`, { method: 'DELETE' }),
  refreshStreamStatus: (serverId: number, streamId: number) =>
    fetchApi<StreamStats>(`/servers/${serverId}/streams/${streamId}/refresh`, { method: 'POST' }),

  // Permissions
  getPermissions: () => fetchApi<Permission[]>('/permissions'),
  createPermission: (data: Partial<Permission>) =>
    fetchApi<Permission>('/permissions', { method: 'POST', body: JSON.stringify(data) }),
  deletePermission: (id: number) =>
    fetchApi<void>(`/permissions/${id}`, { method: 'DELETE' }),
    
  // Server health monitoring
  getServersHealth: () => fetchApi<Record<number, { status: string; error?: string }>>('/servers/health'),
  
  // Stream analytics
  getStreamStats: (streamId: number) =>
    fetchApi<StreamStats>(`/streams/${streamId}/stats`),
};
