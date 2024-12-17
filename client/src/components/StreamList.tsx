import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import type { StreamWithStats } from '@/types';
import { streamWS } from '@/lib/websocket';
import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Activity, Users, Wifi } from 'lucide-react';

export default function StreamList() {
  const [streams, setStreams] = useState<StreamWithStats[]>([]);
  
  const { data, isLoading } = useQuery({
    queryKey: ['/api/streams'],
    queryFn: () => fetch('/api/streams', { credentials: 'include' }).then(res => res.json()),
  });

  useEffect(() => {
    if (data) {
      setStreams(data);
    }
  }, [data]);

  useEffect(() => {
    const unsubscribe = streamWS.subscribe((message) => {
      if (message.type === 'stats') {
        setStreams(prev => 
          prev.map(stream => 
            stream.id === message.streamId 
              ? { ...stream, streamStatus: message.data } 
              : stream
          )
        );
      }
    });

    return () => unsubscribe();
  }, []);

  if (isLoading) {
    return <Skeleton className="w-full h-[400px]" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Streams</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Stream Key</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Viewers</TableHead>
              <TableHead>Bitrate</TableHead>
              <TableHead>Uptime</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {streams.map((stream) => (
              <TableRow key={stream.id}>
                <TableCell className="font-medium">{stream.name}</TableCell>
                <TableCell>{stream.streamKey}</TableCell>
                <TableCell>
                  <Badge variant={stream.streamStatus?.isActive ? 'default' : 'secondary'}>
                    <Activity className="w-4 h-4 mr-1" />
                    {stream.streamStatus?.isActive ? 'Online' : 'Offline'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center">
                    <Users className="w-4 h-4 mr-1" />
                    {stream.streamStatus?.activeViewers || 0}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center">
                    <Wifi className="w-4 h-4 mr-1" />
                    {stream.streamStatus ? `${Math.round(stream.streamStatus.bitrate / 1024)} Kbps` : 'N/A'}
                  </div>
                </TableCell>
                <TableCell>
                  {stream.streamStatus?.isActive
                    ? formatDistanceToNow(Date.now() - stream.streamStatus.uptime * 1000, { addSuffix: true })
                    : 'Offline'
                  }
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}