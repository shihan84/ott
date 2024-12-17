import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { formatBytes } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

interface TrafficData {
  month: string;
  bytesIn: number;
  bytesOut: number;
}

interface MonthlyTrafficStatsProps {
  streamId: number;
}

export default function MonthlyTrafficStats({ streamId }: MonthlyTrafficStatsProps) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['/api/streams', streamId, 'traffic'],
    queryFn: () => api.getStreamTraffic(streamId),
  });

  const chartData = useMemo(() => {
    if (!stats) return [];
    return stats.map(stat => ({
      month: `${stat.year}-${String(stat.month).padStart(2, '0')}`,
      bytesIn: Number(stat.bytesIn),
      bytesOut: Number(stat.bytesOut),
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
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <XAxis dataKey="month" />
          <YAxis tickFormatter={(value) => formatBytes(value)} />
          <Tooltip 
            formatter={(value: number) => formatBytes(value)}
            labelFormatter={(label) => {
              const [year, month] = label.split('-');
              return `${new Date(Number(year), Number(month) - 1).toLocaleString('default', { 
                month: 'long', 
                year: 'numeric' 
              })}`;
            }}
          />
          <Legend />
          <Bar name="Input Traffic" dataKey="bytesIn" fill="var(--chart-1)" />
          <Bar name="Output Traffic" dataKey="bytesOut" fill="var(--chart-2)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
