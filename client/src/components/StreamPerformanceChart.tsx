import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatBytes } from '@/lib/utils';

interface DataPoint {
  timestamp: number;
  bitrate: number;
  viewers: number;
  bytesIn: number;
  bytesOut: number;
}

interface StreamPerformanceChartProps {
  data: DataPoint[];
}

type MetricType = 'bitrate' | 'viewers' | 'traffic';

const formatBitrate = (value: number) => `${(value / 1000).toFixed(2)} Mbps`;
const formatViewers = (value: number) => `${value} viewers`;

export default function StreamPerformanceChart({ data }: StreamPerformanceChartProps) {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('bitrate');

  const chartData = useMemo(() => {
    return data.map(point => ({
      ...point,
      time: new Date(point.timestamp).toLocaleTimeString(),
      totalTraffic: point.bytesIn + point.bytesOut
    }));
  }, [data]);

  const renderChart = () => {
    switch (selectedMetric) {
      case 'bitrate':
        return (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis tickFormatter={formatBitrate} />
            <Tooltip formatter={(value: number) => formatBitrate(value)} />
            <Legend />
            <Line
              type="monotone"
              dataKey="bitrate"
              stroke="hsl(var(--primary))"
              name="Bitrate"
              dot={false}
            />
          </LineChart>
        );
      case 'viewers':
        return (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis tickFormatter={formatViewers} />
            <Tooltip formatter={(value: number) => formatViewers(value)} />
            <Legend />
            <Line
              type="monotone"
              dataKey="viewers"
              stroke="hsl(var(--primary))"
              name="Viewers"
              dot={false}
            />
          </LineChart>
        );
      case 'traffic':
        return (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis tickFormatter={formatBytes} />
            <Tooltip formatter={(value: number) => formatBytes(value)} />
            <Legend />
            <Line
              type="monotone"
              dataKey="bytesIn"
              stroke="hsl(var(--primary))"
              name="Input Traffic"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="bytesOut"
              stroke="hsl(var(--chart-2))"
              name="Output Traffic"
              dot={false}
            />
          </LineChart>
        );
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Performance Metrics</CardTitle>
        <Select value={selectedMetric} onValueChange={(value: MetricType) => setSelectedMetric(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select metric" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bitrate">Bitrate</SelectItem>
            <SelectItem value="viewers">Viewers</SelectItem>
            <SelectItem value="traffic">Traffic</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer>{renderChart()}</ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
