import { useParams } from 'wouter';
import { useUser } from '@/hooks/use-user';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Loader2 } from 'lucide-react';
// Monthly traffic stats import removed for future update
import { useLocation } from 'wouter';
import { Activity, Users, Wifi } from 'lucide-react';
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
  
  const { data: stream, isLoading } = useQuery<StreamWithStats>({
    queryKey: ['/api/streams', streamId],
    queryFn: async () => {
      if (user?.isAdmin && serverId) {
        const streams = await api.getServerStreams(parseInt(serverId));
        const stream = streams.find(s => s.id === parseInt(streamId!));
        if (!stream) throw new Error('Stream not found');
        return stream;
      } else {
        const streams = await api.getPermittedStreams();
        const stream = streams.find(s => s.id === parseInt(streamId!));
        if (!stream) throw new Error('Stream not found');
        return stream;
      }
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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

  // Construct HLS URL based on server URL and stream key with fallback paths
  const streamUrl = (() => {
    if (!stream || !stream.server?.url || !stream.streamKey) {
      console.log('Missing stream data:', { stream, serverUrl: stream?.server?.url, streamKey: stream?.streamKey });
      return '';
    }
    
    if (!stream.streamStatus?.stats.alive) {
      console.log('Stream is not alive:', stream.streamStatus);
      return '';
    }

    // Use the exact server URL and streamKey format
    const url = `${stream.server.url.replace(/\/$/, '')}/${stream.streamKey}/index.m3u8`;
    
    console.log('Stream URL:', {
      url,
      streamDetails: {
        serverUrl: stream.server.url,
        streamKey: stream.streamKey,
        isAlive: stream.streamStatus?.stats.alive
      }
    });
    
    return url;
  })();
  
  // Detailed logging for stream debugging
  console.log('Stream details:', {
    streamUrl,
    serverUrl: stream?.server?.url,
    streamKey: stream?.streamKey,
    isAlive: stream?.streamStatus?.stats.alive,
    streamStatus: stream?.streamStatus,
    protocol: window.location.protocol,
    constructedUrl: stream?.server?.url ? 
      `${window.location.protocol}//${stream.server.url.replace(/^https?:\/\//, '')}/live/${stream.streamKey}/index.m3u8` 
      : 'Unable to construct URL'
  });
  
  // Get available video qualities from media info
  const videoTracks = stream?.streamStatus?.stats?.media_info?.tracks.filter(
    track => track.content === 'video'
  ) || [];

  return (
    <div className="container mx-auto py-6 space-y-4">
      <div className="flex items-center mb-4">
        <Button 
          variant="outline" 
          onClick={() => setLocation(user?.isAdmin ? `/servers/${serverId}/streams` : '/')}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back to Streams
        </Button>
      </div>
      <div className="flex justify-center mb-6">
        <div className="w-full max-w-[600px]">
          <StreamPlayer 
            url={streamUrl} 
            title={stream.name}
            videoTracks={videoTracks}
          />
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{stream.name}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Stream Details and Monitoring
          </p>
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
              <Activity className="w-5 h-5 text-primary" />
              <h3 className="font-medium">Traffic & Push Status</h3>
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
            
            {/* Stream Push Information */}
            <div className="mt-6 border-t pt-4">
              <h4 className="font-medium mb-2">Push Destinations</h4>
              {stream.streamStatus?.pushes?.length ? (
                <div className="space-y-4">
                  {stream.streamStatus.pushes.map((push, index) => (
                    <div key={push.stats.id || index} className="bg-accent/50 p-3 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div className="break-all">
                          <p className="text-sm font-medium">{push.url}</p>
                          <Badge variant={push.stats.status === 'running' ? 'default' : 'secondary'} className="mt-1">
                            {push.stats.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div>
                          <span className="text-xs text-muted-foreground">Transferred</span>
                          <p className="text-sm font-medium">{formatBytes(push.stats.bytes)}</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Retries</span>
                          <p className="text-sm font-medium">{push.stats.retries || 0}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No push destinations configured</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Traffic Stats section removed for future update */}
    </div>
  );
}