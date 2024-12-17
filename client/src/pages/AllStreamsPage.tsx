import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Activity, Users, Wifi } from 'lucide-react';
import { useLocation } from 'wouter';
import type { StreamWithStats } from '@/types';
import { api } from '@/lib/api';

function formatBitrate(bitrate: number | undefined): string {
  if (!bitrate || typeof bitrate !== 'number') return 'N/A';
  const mbps = bitrate / 1000;
  return `${mbps.toFixed(2)} Mbps`;
}

export default function AllStreamsPage() {
  const [, setLocation] = useLocation();
  
  const { data: streams, isLoading } = useQuery<StreamWithStats[]>({
    queryKey: ['/api/streams/permitted'],
    queryFn: async () => {
      // This will be a new endpoint that returns all permitted streams for the user
      const response = await api.getPermittedStreams();
      return response;
    },
  });

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
        <CardHeader>
          <CardTitle>My Streams</CardTitle>
        </CardHeader>
        <CardContent>
          {streams?.length === 0 ? (
            <div className="text-center p-4 text-muted-foreground">
              No streams available
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Viewers</TableHead>
                  <TableHead>Bitrate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {streams?.map((stream) => (
                  <TableRow 
                    key={stream.id} 
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => setLocation(`/streams/${stream.id}`)}
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
                        {formatBitrate(stream.streamStatus?.stats.input_bitrate)}
                      </div>
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
