import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getBarAnimationProps, getCartesianGridAnimationProps } from '../../utils/chartAnimation';
import { SafeLegend } from './shared';
import type { DepartmentStat } from './types';

interface DepartmentChartProps {
  data: DepartmentStat[];
  reduceMotion: boolean;
}

/** Horizontal department breakdown bar chart — lazy-loaded (below the fold). */
export default function DepartmentChart({ data, reduceMotion }: DepartmentChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical">
        <CartesianGrid
          strokeDasharray="3 3"
          opacity={0.2}
          {...getCartesianGridAnimationProps(reduceMotion)}
        />
        <XAxis type="number" tick={{ fontSize: 12 }} />
        <YAxis dataKey="department" type="category" tick={{ fontSize: 12 }} width={90} />
        <Tooltip />
        <SafeLegend />
        <Bar
          dataKey="total"
          fill="var(--chart-2, #10b981)"
          name="Total Cost ($)"
          {...getBarAnimationProps(reduceMotion)}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
