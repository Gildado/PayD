import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { PieLabelRenderProps } from 'recharts';
import { getPieAnimationProps } from '../../utils/chartAnimation';
import { PIE_COLORS, SafeLegend } from './shared';
import type { CurrencyShare } from './types';

interface CurrencyPieChartProps {
  data: CurrencyShare[];
  reduceMotion: boolean;
}

/** Currency distribution pie chart — lazy-loaded (below the fold). */
export default function CurrencyPieChart({ data, reduceMotion }: CurrencyPieChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="currency"
          cx="50%"
          cy="50%"
          outerRadius={80}
          label={(props: PieLabelRenderProps) => `${props.name ?? ''}: ${props.value ?? 0}%`}
          {...getPieAnimationProps(reduceMotion)}
        >
          {data.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={PIE_COLORS[index % PIE_COLORS.length] ?? PIE_COLORS[0]}
            />
          ))}
        </Pie>
        <Tooltip />
        <SafeLegend />
      </PieChart>
    </ResponsiveContainer>
  );
}
