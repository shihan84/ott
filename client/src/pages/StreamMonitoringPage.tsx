import { useParams } from 'wouter';
import { useUser } from '@/hooks/use-user';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Loader2 } from 'lucide-react';
import MonthlyTrafficStats from '@/components/MonthlyTrafficStats';
import StreamPerformanceChart from '@/components/StreamPerformanceChart';
import { useLocation } from 'wouter';
import { Activity, Users, Wifi, Clock } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import type { StreamWithStats, MediaTrack } from '@/types';
import { api } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import StreamPlayer from '@/components/StreamPlayer';
import { useToast } from '@/hooks/use-toast';

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

function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined) return 'N/A';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(2)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(2)} MB`;
  const gb = mb / 1024;
  if (gb < 1024) return `${gb.toFixed(2)} GB`;
  const tb = gb / 1024;
  return `${tb.toFixed(2)} TB`;
}


export default function StreamMonitoringPage() {
  const [, setLocation] = useLocation();
  const { serverId, streamId } = useParams();
  const { user } = useUser();
  const [performanceData, setPerformanceData] = useState<Array<{
    timestamp: number;
    bitrate: number;
    viewers: number;
    bytesIn: number;
    bytesOut: number;
  }>>([]);
  
  // Use useCallback to memoize the query function
  const queryFn = useCallback(async () => {
    if (!streamId) throw new Error('Stream ID is required');
    
    if (user?.isAdmin && serverId) {
      const streams = await api.getServerStreams(parseInt(serverId));
      const stream = streams.find(s => s.id === parseInt(streamId));
      if (!stream) throw new Error('Stream not found');
      return stream;
    } else {
      const streams = await api.getPermittedStreams();
      const stream = streams.find(s => s.id === parseInt(streamId));
      if (!stream) throw new Error('Stream not found');
      return stream;
    }
  }, [user?.isAdmin, serverId, streamId]); // Stable dependencies

  const { data: stream, isLoading } = useQuery<StreamWithStats>({
    queryKey: ['/api/streams', streamId],
    queryFn,
    refetchInterval: 5000, // Refresh every 5 seconds
    enabled: Boolean(streamId), // Only run query when streamId is available
    staleTime: 4000, // Consider data fresh for 4 seconds to prevent unnecessary refetches
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Update performance data when stream stats change
  useEffect(() => {
    const updateInterval = setInterval(() => {
      const stats = stream?.streamStatus?.stats;
      if (stats) {
        setPerformanceData(prev => {
          // Keep last 60 data points (5 minutes with 5-second intervals)
          const newData = [...prev.slice(-59), {
            timestamp: Date.now(),
            bitrate: stats.input_bitrate || 0,
            viewers: stats.online_clients || 0,
            bytesIn: stats.bytes_in || 0,
            bytesOut: stats.bytes_out || 0,
          }];
          return newData;
        });
      }
    }, 5000); // Update every 5 seconds to match query refresh interval

    return () => clearInterval(updateInterval);
  }, [stream]); // Depend on the entire stream object to prevent unnecessary interval recreations

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

  // Construct HLS URL based on server URL and stream key
  const streamUrl = stream && stream.streamStatus?.stats.alive && stream.server?.url ? 
    `${stream.server.url.replace(/\/$/, '')}/${stream.streamKey}/index.m3u8` : '';
  
  console.log('Stream URL:', streamUrl); // Add logging for debugging
  
  // Get available video qualities from media info
  const videoTracks = stream?.streamStatus?.stats?.media_info?.tracks.filter(
    track => track.content === 'video'
  ) || [];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="max-w-3xl mx-auto">
        <StreamPlayer 
          url={streamUrl} 
          title={stream.name}
          videoTracks={videoTracks}
        />
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{stream.name}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Stream Details and Monitoring
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setLocation(user?.isAdmin ? `/servers/${serverId}/streams` : '/')}
          >
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

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              <h3 className="font-medium">Monthly Traffic</h3>
            </div>
            <p className="mt-2 text-2xl font-bold">
              {stream.streamStatus?.stats ? formatBytes(stream.streamStatus.stats.bytes_in + stream.streamStatus.stats.bytes_out) : 'N/A'}
            </p>
            <p className="text-sm text-muted-foreground">Total data transferred</p>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-muted-foreground">Input Traffic</span>
                <p className="text-lg font-semibold">
                  {stream.streamStatus?.stats ? formatBytes(stream.streamStatus.stats.bytes_in) : 'N/A'}
                </p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Output Traffic</span>
                <p className="text-lg font-semibold">
                  {stream.streamStatus?.stats ? formatBytes(stream.streamStatus.stats.bytes_out) : 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Charts */}
      {stream && (
        <StreamPerformanceChart data={performanceData} />
      )}

      {/* Monthly Traffic Stats */}
      {stream && (
        <Card>
          <CardHeader>
            <CardTitle>Traffic History</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyTrafficStats streamId={stream.id} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}