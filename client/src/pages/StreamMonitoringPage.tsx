import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { useLocation } from 'wouter';
import { Activity, Users, Wifi, Clock } from 'lucide-react';
import type { StreamWithStats } from '@/types';
import { api } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';

function formatBitrate(bitrate: number | undefined): string {
  if (!bitrate || typeof bitrate !== 'number') return 'N/A';
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

export default function StreamMonitoringPage() {
  const [, setLocation] = useLocation();
  const { serverId, streamId } = useParams();
  
  const { data: stream, isLoading } = useQuery<StreamWithStats>({
    queryKey: ['/api/servers', serverId, 'streams', streamId],
    queryFn: async () => {
      const streams = await api.getServerStreams(parseInt(serverId!));
      const stream = streams.find(s => s.id === parseInt(streamId!));
      if (!stream) throw new Error('Stream not found');
      return stream;
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  if (!stream) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Stream Not Found</CardTitle>
            <Button variant="outline" onClick={() => setLocation(`/servers/${serverId}/streams`)}>
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back to Streams
            </Button>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{stream.name}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Stream Details and Monitoring
            </p>
          </div>
          <Button variant="outline" onClick={() => setLocation(`/servers/${serverId}/streams`)}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Streams
          </Button>
        </CardHeader>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              <h3 className="font-medium">Status</h3>
            </div>
            <p className="mt-2 text-2xl font-bold">
              {stream.streamStatus?.stats.alive ? 'Online' : 'Offline'}
            </p>
            {stream.streamStatus?.stats.alive && stream.streamStatus?.stats.opened_at && (
              <p className="text-sm text-muted-foreground">
                Since {formatDistanceToNow(new Date(stream.streamStatus.stats.opened_at * 1000), { addSuffix: true })}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <h3 className="font-medium">Viewers</h3>
            </div>
            <p className="mt-2 text-2xl font-bold">
              {stream.streamStatus?.stats.online_clients || 0}
            </p>
            <p className="text-sm text-muted-foreground">Current live viewers</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Wifi className="w-5 h-5 text-primary" />
              <h3 className="font-medium">Bitrate</h3>
            </div>
            <p className="mt-2 text-2xl font-bold">
              {formatBitrate(stream.streamStatus?.stats.input_bitrate)}
            </p>
            <p className="text-sm text-muted-foreground">Current input bitrate</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              <h3 className="font-medium">Uptime</h3>
            </div>
            <p className="mt-2 text-2xl font-bold">
              {stream.streamStatus?.stats.alive && stream.streamStatus.stats.opened_at
                ? formatUptime(stream.streamStatus.stats.opened_at)
                : 'Offline'
              }
            </p>
            <p className="text-sm text-muted-foreground">Hours:Minutes</p>
          </CardContent>
        </Card>
      </div>

      {stream.streamStatus?.stats.media_info && (
        <Card>
          <CardHeader>
            <CardTitle>Stream Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {stream.streamStatus.stats.media_info.tracks.map((track: MediaTrack, index: number) => (
                <div key={index} className="space-y-2">
                  <h3 className="font-medium">{track.content.toUpperCase()} Track</h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {Object.entries(track).map(([key, value]) => 
                      key !== 'content' ? (
                        <div key={key} className="flex justify-between space-x-4">
                          <span className="text-sm text-muted-foreground capitalize">
                            {key.replace(/_/g, ' ')}
                          </span>
                          <span className="text-sm font-medium">{value?.toString() || 'N/A'}</span>
                        </div>
                      ) : null
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
