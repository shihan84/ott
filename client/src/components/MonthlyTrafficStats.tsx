import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { formatBytes } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface MonthlyTrafficStatsProps {
  streamId: number;
}

export default function MonthlyTrafficStats({ streamId }: MonthlyTrafficStatsProps) {
  const { toast } = useToast();
  const { data: stats, isLoading } = useQuery({
    queryKey: ['/api/streams', streamId, 'traffic'],
    queryFn: () => api.getStreamTraffic(streamId),
    retry: false,
    staleTime: 30000, // Refresh every 30 seconds
    onError: (error: Error) => {
      console.error('Failed to load traffic stats:', error);
      toast({
        title: "Error",
        description: "Failed to load traffic statistics",
        variant: "destructive",
      });
    }
  });

  const tableData = useMemo(() => {
    if (!stats) return [];
    return stats.map(stat => ({
      month: new Date(stat.year, stat.month - 1).toLocaleString('default', { 
        month: 'long', 
        year: 'numeric' 
      }),
      totalBytes: Number(stat.bytesIn) + Number(stat.bytesOut),
      lastUpdated: new Date(stat.lastUpdated).toLocaleString(),
    }));
  }, [stats]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {!stats || tableData.length === 0 ? (
        <div className="col-span-full text-center text-muted-foreground py-4">
          No traffic data available for this stream
        </div>
      ) : (
        tableData.map((row, index) => (
          <Card key={index}>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{formatBytes(row.totalBytes)}</div>
              <p className="text-xs text-muted-foreground mt-1">{row.month}</p>
              <p className="text-xs text-muted-foreground mt-1">Last updated: {row.lastUpdated}</p>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}