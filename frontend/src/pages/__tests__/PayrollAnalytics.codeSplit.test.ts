import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), 'src', relativePath), 'utf8');

const pageSource = readSource('pages/PayrollAnalytics.tsx');

const CHART_MODULES = [
  { file: 'PayrollTrendChart', root: 'AreaChart', secondRoot: 'LineChart' },
  { file: 'CurrencyPieChart', root: 'PieChart' },
  { file: 'PaymentMetricsChart', root: 'BarChart' },
  { file: 'DepartmentChart', root: 'BarChart' },
] as const;

describe('PayrollAnalytics code splitting', () => {
  it('does not statically import recharts in the page module', () => {
    expect(pageSource).not.toMatch(/from\s+['"]recharts['"]/);
    expect(pageSource).not.toMatch(
      /from\s+['"].*\/components\/charts\/(PayrollTrendChart|CurrencyPieChart|PaymentMetricsChart|DepartmentChart)['"]/
    );
  });

  it('dynamically imports every chart module with React.lazy', () => {
    for (const { file } of CHART_MODULES) {
      expect(pageSource).toMatch(
        new RegExp(`lazy\\(\\(\\) => import\\(['"]\\.\\.\\/components\\/charts\\/${file}['"]\\)\\)`)
      );
    }
  });

  it('wraps chart chunks in Suspense boundaries', () => {
    expect(pageSource).toContain('<Suspense');
    expect(pageSource.match(/<Suspense/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it('defers the three below-the-fold charts until near the viewport', () => {
    expect(pageSource).toContain('useDeferredMount()');
    expect(pageSource.match(/useDeferredMount\(\)/g)?.length).toBe(3);
    expect(pageSource).toContain('components/charts/useDeferredMount');
  });

  it.each(CHART_MODULES)('keeps $root rendering in the $file chunk', ({ file, root }) => {
    const source = readSource(`components/charts/${file}.tsx`);
    expect(source).toMatch(/from\s+['"]recharts['"]/);
    expect(source).toContain(`<${root}`);
    expect(source).toContain('export default function');
    expect(source).toContain('<ResponsiveContainer');
  });

  it('renders both line and area variants in the trend chunk', () => {
    const source = readSource('components/charts/PayrollTrendChart.tsx');
    expect(source).toContain('<LineChart');
    expect(source).toContain('<AreaChart');
    expect(source).toContain("type === 'line'");
  });
});
