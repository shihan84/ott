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
  getServerStreams: (serverId: number) => 
    fetchApi<StreamWithStats[]>(`/servers/${serverId}/streams`),
    
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
};
