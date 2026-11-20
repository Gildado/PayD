import type { CSSProperties } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { PieLabelRenderProps } from 'recharts';
import { PIE_COLORS, SafeLegend } from './shared';
import type { CurrencyShare, RechartsValue } from './types';

interface CurrencyPieChartProps {
  data: CurrencyShare[];
  tooltipStyle: CSSProperties;
}

/** Currency distribution pie chart — lazy-loaded (below the fold). */
export default function CurrencyPieChart({ data, tooltipStyle }: CurrencyPieChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="currency"
          cx="50%"
          cy="50%"
          outerRadius={100}
          label={(props: PieLabelRenderProps) => {
            const d = props as PieLabelRenderProps & {
              currency?: string;
              value?: number;
            };
            return `${d.currency ?? ''} ${d.value ?? 0}%`;
          }}
        >
          {data.map((item: CurrencyShare, idx: number) => (
            <Cell key={item.currency} fill={PIE_COLORS[idx % PIE_COLORS.length] ?? PIE_COLORS[0]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v: RechartsValue) => [
            `${String(Array.isArray(v) ? (v[0] ?? 0) : (v ?? 0))}%`,
            'Share',
          ]}
          contentStyle={tooltipStyle}
        />
        <SafeLegend />
      </PieChart>
    </ResponsiveContainer>
  );
}
