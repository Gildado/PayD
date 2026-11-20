import type { CSSProperties } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { SafeLegend } from './shared';
import type { DepartmentStat, RechartsValue } from './types';

interface DepartmentChartProps {
  data: DepartmentStat[];
  tooltipStyle: CSSProperties;
}

/** Horizontal department breakdown bar chart — lazy-loaded (below the fold). */
export default function DepartmentChart({ data, tooltipStyle }: DepartmentChartProps) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 44)}>
      <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 12, fill: 'var(--muted)' }}
          tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
          stroke="var(--border)"
        />
        <YAxis
          type="category"
          dataKey="department"
          tick={{ fontSize: 12, fill: 'var(--muted)' }}
          stroke="var(--border)"
          width={90}
        />
        <Tooltip
          formatter={(v: RechartsValue, name?: string | number) => {
            const label = name === undefined ? '' : String(name);
            if (label === 'Total ($)') {
              const num = Number(Array.isArray(v) ? (v[0] ?? 0) : (v ?? 0));
              return [`$${Math.round(num).toLocaleString()}`, label];
            }
            return [v, label];
          }}
          contentStyle={tooltipStyle}
        />
        <SafeLegend />
        <Bar dataKey="total" name="Total ($)" fill="#6366f1" radius={[0, 4, 4, 0]} />
        <Bar dataKey="headcount" name="Headcount" fill="#22d3ee" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
