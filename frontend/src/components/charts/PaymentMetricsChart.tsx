import type { CSSProperties } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { SafeLegend } from './shared';
import type { PaymentMetric } from './types';

interface PaymentMetricsChartProps {
  data: PaymentMetric[];
  tooltipStyle: CSSProperties;
}

/** Success / failure / pending bar chart — lazy-loaded (below the fold). */
export default function PaymentMetricsChart({ data, tooltipStyle }: PaymentMetricsChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 12, fill: 'var(--muted)' }}
          stroke="var(--border)"
        />
        <YAxis tick={{ fontSize: 12, fill: 'var(--muted)' }} stroke="var(--border)" />
        <Tooltip contentStyle={tooltipStyle} />
        <SafeLegend />
        <Bar dataKey="success" name="Successful" fill="#22d3ee" radius={[4, 4, 0, 0]} />
        <Bar dataKey="failure" name="Failed" fill="#f87171" radius={[4, 4, 0, 0]} />
        <Bar dataKey="pending" name="Pending" fill="#f59e0b" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
