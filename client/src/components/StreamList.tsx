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
    queryFn: api.getStreams,
  });

  useEffect(() => {
    if (data) {
      setStreams(data as StreamWithStats[]);
    }
  }, [data]);

  useEffect(() => {
    const unsubscribe = streamWS.subscribe((message) => {
      if (message.type === 'stats') {
        setStreams(prev => 
          prev.map(stream => 
            stream.id === message.streamId 
              ? { ...stream, stats: message.data }
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
              <TableHead>Server</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Viewers</TableHead>
              <TableHead>Bandwidth</TableHead>
              <TableHead>Uptime</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {streams.map((stream) => (
              <TableRow key={stream.id}>
                <TableCell className="font-medium">{stream.name}</TableCell>
                <TableCell>{stream.server.name}</TableCell>
                <TableCell>
                  <Badge variant={stream.stats.status === 'online' ? 'success' : 'secondary'}>
                    <Activity className="w-4 h-4 mr-1" />
                    {stream.stats.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center">
                    <Users className="w-4 h-4 mr-1" />
                    {stream.stats.viewers}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center">
                    <Wifi className="w-4 h-4 mr-1" />
                    {Math.round(stream.stats.bandwidth / 1024 / 1024)} Mbps
                  </div>
                </TableCell>
                <TableCell>
                  {stream.stats.status === 'online' 
                    ? formatDistanceToNow(Date.now() - stream.stats.uptime * 1000, { addSuffix: true })
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
