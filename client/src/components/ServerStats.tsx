import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Server } from '@db/schema';
import { Skeleton } from '@/components/ui/skeleton';

export default function ServerStats() {
  const { data: servers, isLoading } = useQuery<Server[]>({
    queryKey: ['/api/servers'],
    queryFn: api.getServers,
  });

  if (isLoading) {
    return <Skeleton className="w-full h-[300px]" />;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {servers?.map((server) => (
        <Card key={server.id}>
          <CardHeader>
            <CardTitle>{server.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart
                data={[
                  { time: '00:00', value: 0 },
                  { time: '04:00', value: 30 },
                  { time: '08:00', value: 60 },
                  { time: '12:00', value: 100 },
                  { time: '16:00', value: 80 },
                  { time: '20:00', value: 45 },
                  { time: '24:00', value: 10 },
                ]}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id={`gradient-${server.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  fillOpacity={1}
                  fill={`url(#gradient-${server.id})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
