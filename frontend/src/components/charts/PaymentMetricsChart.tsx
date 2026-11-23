import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getBarAnimationProps, getCartesianGridAnimationProps } from '../../utils/chartAnimation';
import { SafeLegend } from './shared';
import type { PaymentMetric } from './types';

interface PaymentMetricsChartProps {
  data: PaymentMetric[];
  reduceMotion: boolean;
}

/** Success / failure / pending bar chart — lazy-loaded (below the fold). */
export default function PaymentMetricsChart({ data, reduceMotion }: PaymentMetricsChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid
          strokeDasharray="3 3"
          opacity={0.2}
          {...getCartesianGridAnimationProps(reduceMotion)}
        />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <SafeLegend />
        <Bar
          dataKey="success"
          fill="var(--chart-4, #10b981)"
          name="Successful"
          {...getBarAnimationProps(reduceMotion)}
        />
        <Bar
          dataKey="failure"
          fill="var(--chart-5, #ef4444)"
          name="Failed"
          {...getBarAnimationProps(reduceMotion)}
        />
        <Bar
          dataKey="pending"
          fill="var(--chart-3, #f59e0b)"
          name="Pending"
          {...getBarAnimationProps(reduceMotion)}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
