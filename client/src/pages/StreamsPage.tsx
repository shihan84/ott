import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Activity, Users, Wifi, ChevronLeft } from 'lucide-react';
import { formatDistanceToNow, formatDistance } from 'date-fns';
import type { StreamWithStats } from '@/types';
import { api } from '@/lib/api';

function formatBitrate(bitrate: number | undefined): string {
  if (!bitrate || typeof bitrate !== 'number') return 'N/A';
  // Convert from Kbps to Mbps (input is already in Kbps)
  const mbps = bitrate / 1000;
  return `${mbps.toFixed(2)} Mbps`;
}

function formatUptime(timestamp: number): string {
  if (!timestamp) return 'Unknown';
  const now = Date.now();
  const startTime = timestamp * 1000; // Convert to milliseconds
  const diffMs = now - startTime;
  
  // Convert to hours and minutes
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export default function StreamsPage() {
  const [, setLocation] = useLocation();
  const { serverId } = useParams();
  
  const { data: streams, isLoading, error } = useQuery<StreamWithStats[]>({
    queryKey: ['/api/servers', serverId, 'streams'],
    queryFn: async () => {
      console.log('Fetching streams for server:', serverId);
      const response = await api.getServerStreams(parseInt(serverId!));
      console.log('Server streams response:', response);
      
      // Map and construct proper stream URLs
      return response.map(stream => {
        // Log stream details for debugging
        console.log('Processing stream:', {
          streamUrl: stream.server?.url,
          serverUrl: stream.server?.url,
          streamKey: stream.streamKey,
          isAlive: stream.streamStatus?.stats.alive,
          streamStatus: stream.streamStatus,
          protocol: stream.server?.url ? new URL(stream.server.url).protocol : undefined
        });

        // Construct proper HLS URL
        const serverUrl = stream.server?.url;
        let streamUrl = '';
        
        if (serverUrl && stream.streamKey) {
          try {
            const url = new URL(serverUrl);
            // Ensure URL ends with stream key and index.m3u8
            streamUrl = `${url.protocol}//${url.host}/${stream.streamKey}/index.m3u8`;
            console.log('Constructed stream URL:', streamUrl);
          } catch (e) {
            console.error('Failed to construct stream URL:', e);
          }
        }
        
        return {
          ...stream,
          server: {
            url: streamUrl
          }
        };
      });
    },
    enabled: !!serverId,
    refetchInterval: 10000, // Refetch every 10 seconds for live status
  });

  if (error) {
    console.error('Error fetching streams:', error);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Server Streams</CardTitle>
          <Button variant="outline" onClick={() => setLocation('/')}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Servers
          </Button>
        </CardHeader>
        <CardContent>
          {streams?.length === 0 ? (
            <div className="text-center p-4 text-muted-foreground">
              No streams found for this server
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Viewers</TableHead>
                  <TableHead>Bitrate</TableHead>
                  <TableHead>Uptime</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {streams?.map((stream) => (
                  <TableRow 
                    key={stream.id} 
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => setLocation(`/servers/${serverId}/streams/${stream.id}`)}
                  >
                    <TableCell className="font-medium">{stream.name}</TableCell>
                    <TableCell>
                      <Badge variant={stream.streamStatus?.stats.alive ? 'default' : 'secondary'}>
                        <Activity className="w-4 h-4 mr-1" />
                        {stream.streamStatus?.stats.alive ? 'Online' : 'Offline'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Users className="w-4 h-4 mr-1" />
                        {stream.streamStatus?.stats.online_clients || 0}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Wifi className="w-4 h-4 mr-1" />
                        {formatBitrate(stream.streamStatus?.stats?.input_bitrate)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {stream.streamStatus?.stats.alive && stream.streamStatus.stats.last_dts
                        ? formatUptime(stream.streamStatus.stats.opened_at)
                        : 'Offline'
                      }
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
