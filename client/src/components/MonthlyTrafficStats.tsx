import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { formatBytes } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

interface MonthlyTrafficStatsProps {
  streamId: number;
}

export default function MonthlyTrafficStats({ streamId }: MonthlyTrafficStatsProps) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['/api/streams', streamId, 'traffic'],
    queryFn: () => api.getStreamTraffic(streamId),
    retry: false,
    staleTime: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentMonth = stats?.[0];
  if (!currentMonth) {
    return (
      <div className="text-center text-muted-foreground py-4">
        No traffic data available for this stream
      </div>
    );
  }

  const totalBytes = Number(currentMonth.bytesIn) + Number(currentMonth.bytesOut);
  const month = new Date(currentMonth.year, currentMonth.month - 1).toLocaleString('default', { 
    month: 'long', 
    year: 'numeric' 
  });

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-2xl font-bold">{formatBytes(totalBytes)}</div>
        <p className="text-xs text-muted-foreground mt-1">{month}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Last updated: {new Date(currentMonth.lastUpdated).toLocaleString()}
        </p>
      </CardContent>
    </Card>
  );
}