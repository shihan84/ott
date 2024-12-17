import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
      bytesIn: Number(stat.bytesIn),
      bytesOut: Number(stat.bytesOut),
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Month</TableHead>
            <TableHead>Input Traffic</TableHead>
            <TableHead>Output Traffic</TableHead>
            <TableHead>Total Transfer</TableHead>
            <TableHead>Last Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!stats || tableData.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                No traffic data available for this stream
              </TableCell>
            </TableRow>
          ) : (
            tableData.map((row, index) => (
              <TableRow key={index}>
                <TableCell>{row.month}</TableCell>
                <TableCell>{formatBytes(Number(stat.bytesIn))}</TableCell>
                <TableCell>{formatBytes(Number(stat.bytesOut))}</TableCell>
                <TableCell>{formatBytes(Number(stat.bytesIn) + Number(stat.bytesOut))}</TableCell>
                <TableCell className="text-muted-foreground">{row.lastUpdated}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
