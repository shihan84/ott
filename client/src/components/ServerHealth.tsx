import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, Cpu, HardDrive as Memory, Signal, Radio, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import type { Server } from '@db/schema';

interface ServerHealthMetrics {
  status: 'online' | 'offline';
  cpuUsage: number;
  memoryUsage: number;
  activeStreams: number;
  totalBandwidth: number;
  lastChecked: string;
}

interface ServerWithHealth extends Server {
  health: ServerHealthMetrics;
}

function MetricCard({ 
  title, 
  value, 
  icon: Icon,
  status,
  showProgress = false,
}: { 
  title: string;
  value: string | number;
  icon: React.ElementType;
  status?: 'success' | 'warning' | 'error';
  showProgress?: boolean;
}) {
  const getStatusColor = () => {
    switch (status) {
      case 'success': return 'text-green-500';
      case 'warning': return 'text-yellow-500';
      case 'error': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${getStatusColor()}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {showProgress && typeof value === 'number' && (
          <Progress 
            value={value} 
            className={`mt-2 ${status === 'error' ? 'bg-red-500' : ''}`}
          />
        )}
      </CardContent>
    </Card>
  );
}

export default function ServerHealth() {
  const { data: servers, isLoading, error } = useQuery({
    queryKey: ['/api/servers/statistics'],
    queryFn: api.getServersHealth,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-[120px]" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to fetch server health metrics
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      {servers?.map((server) => (
        <div key={server.id} className="space-y-4">
          <h3 className="text-lg font-semibold">{server.name}</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              title="Status"
              value={server.health.status}
              icon={Activity}
              status={server.health.status === 'online' ? 'success' : 'error'}
            />
            <MetricCard
              title="CPU Usage"
              value={`${server.health.cpuUsage}%`}
              icon={Cpu}
              status={
                server.health.cpuUsage > 90 
                  ? 'error' 
                  : server.health.cpuUsage > 70 
                    ? 'warning' 
                    : 'success'
              }
              showProgress
            />
            <MetricCard
              title="Memory Usage"
              value={`${server.health.memoryUsage}%`}
              icon={Memory}
              status={
                server.health.memoryUsage > 90 
                  ? 'error' 
                  : server.health.memoryUsage > 70 
                    ? 'warning' 
                    : 'success'
              }
              showProgress
            />
            <MetricCard
              title="Active Streams"
              value={server.health.activeStreams}
              icon={Radio}
            />
            <MetricCard
              title="Total Bandwidth"
              value={`${Math.round(server.health.totalBandwidth / 1024 / 1024)} Mbps`}
              icon={Signal}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
