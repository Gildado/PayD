import type { CSSProperties } from 'react';
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
import { SafeLegend } from './shared';
import type { PayrollTrend, RechartsValue, TrendChartType } from './types';

interface PayrollTrendChartProps {
  data: PayrollTrend[];
  type: TrendChartType;
  tooltipStyle: CSSProperties;
}

/**
 * Monthly payroll trend chart (line / area toggle).
 *
 * Loaded lazily by PayrollAnalytics so recharts stays out of the page's
 * initial bundle. Rendering is byte-for-byte identical to the original
 * inline chart.
 */
export default function PayrollTrendChart({ data, type, tooltipStyle }: PayrollTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      {type === 'area' ? (
        <AreaChart data={data}>
          <defs>
            <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: 'var(--muted)' }}
            stroke="var(--border)"
          />
          <YAxis
            tick={{ fontSize: 12, fill: 'var(--muted)' }}
            tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
            stroke="var(--border)"
          />
          <Tooltip
            formatter={(v: RechartsValue) => [
              `$${Number(Array.isArray(v) ? (v[0] ?? 0) : (v ?? 0)).toLocaleString()}`,
              'Total',
            ]}
            contentStyle={tooltipStyle}
          />
          <SafeLegend />
          <Area
            type="monotone"
            dataKey="total"
            name="Payroll Total"
            stroke="#6366f1"
            strokeWidth={3}
            fill="url(#trendGradient)"
            dot={{ r: 4, fill: '#6366f1' }}
            activeDot={{ r: 6 }}
          />
        </AreaChart>
      ) : (
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: 'var(--muted)' }}
            stroke="var(--border)"
          />
          <YAxis
            tick={{ fontSize: 12, fill: 'var(--muted)' }}
            tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
            stroke="var(--border)"
          />
          <Tooltip
            formatter={(v: RechartsValue) => [
              `$${Number(Array.isArray(v) ? (v[0] ?? 0) : (v ?? 0)).toLocaleString()}`,
              'Total',
            ]}
            contentStyle={tooltipStyle}
          />
          <SafeLegend />
          <Line
            type="monotone"
            dataKey="total"
            name="Payroll Total"
            stroke="#6366f1"
            strokeWidth={3}
            dot={{ r: 4, fill: '#6366f1' }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      )}
    </ResponsiveContainer>
  );
}
