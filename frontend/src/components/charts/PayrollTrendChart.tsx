import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  getAreaAnimationProps,
  getCartesianGridAnimationProps,
  getLineAnimationProps,
} from '../../utils/chartAnimation';
import { SafeLegend } from './shared';
import type { PayrollTrend, TrendChartType } from './types';

interface PayrollTrendChartProps {
  data: PayrollTrend[];
  type: TrendChartType;
  reduceMotion: boolean;
}

/**
 * Monthly payroll trend chart (line / area toggle). Loaded lazily by
 * PayrollAnalytics so recharts stays out of the page's initial bundle.
 */
export default function PayrollTrendChart({ data, type, reduceMotion }: PayrollTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      {type === 'line' ? (
        <LineChart data={data}>
          <CartesianGrid
            strokeDasharray="3 3"
            opacity={0.2}
            {...getCartesianGridAnimationProps(reduceMotion)}
          />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <SafeLegend />
          <Line
            type="monotone"
            dataKey="total"
            stroke="var(--chart-1, #3b82f6)"
            strokeWidth={2}
            name="Total Cost ($)"
            {...getLineAnimationProps(reduceMotion)}
          />
        </LineChart>
      ) : (
        <AreaChart data={data}>
          <CartesianGrid
            strokeDasharray="3 3"
            opacity={0.2}
            {...getCartesianGridAnimationProps(reduceMotion)}
          />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <SafeLegend />
          <Area
            type="monotone"
            dataKey="total"
            stroke="var(--chart-1, #3b82f6)"
            fill="var(--chart-1, #3b82f6)"
            fillOpacity={0.2}
            name="Total Cost ($)"
            {...getAreaAnimationProps(reduceMotion)}
          />
        </AreaChart>
      )}
    </ResponsiveContainer>
  );
}
