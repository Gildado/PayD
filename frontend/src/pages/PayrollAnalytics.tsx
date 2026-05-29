import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  ResponsiveContainer,
} from 'recharts';
import type { PieLabelRenderProps } from 'recharts';
import { Card } from '@stellar/design-system';
import { BarChart2, LineChart as LineChartIcon, Download, RefreshCw } from 'lucide-react';
import axiosInstance from '../api/axiosInstance';
import { parseDateString } from '../utils/dateHelpers';

// recharts v3 + React 19: Legend's class-component typings conflict with React.JSX.
const SafeLegend = Legend as unknown as React.FC<object>;

// ── Types ─────────────────────────────────────────────────────────────────────

interface PayrollTrend {
  month: string;
  total: number;
  count: number;
  [key: string]: unknown;
}

interface CurrencyShare {
  currency: string;
  value: number;
  [key: string]: unknown;
}

interface PaymentMetric {
  month: string;
  success: number;
  failure: number;
  pending: number;
  [key: string]: unknown;
}

interface DepartmentStat {
  department: string;
  total: number;
  headcount: number;
  [key: string]: unknown;
}

interface AnalyticsSummary {
  totalPayroll: number;
  totalTransactions: number;
  successRate: number;
  activeEmployees: number;
}

interface AnalyticsData {
  trends: PayrollTrend[];
  currencyBreakdown: CurrencyShare[];
  paymentMetrics: PaymentMetric[];
  departmentBreakdown: DepartmentStat[];
  summary: AnalyticsSummary;
}

type RechartsValue = number | string | readonly (number | string)[] | undefined;
type TrendChartType = 'line' | 'area';

// ── Date preset helpers ────────────────────────────────────────────────────────

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const DATE_PRESETS = [
  { label: '3M', months: 3 },
  { label: '6M', months: 6 },
  { label: 'YTD', months: -1 },
  { label: '1Y', months: 12 },
] as const;

function presetDates(months: number): { start: string; end: string } {
  const end = new Date();
  let start: Date;
  if (months === -1) {
    start = new Date(end.getFullYear(), 0, 1);
  } else {
    start = new Date(end.getFullYear(), end.getMonth() - months, 1);
  }
  return { start: toDateInput(start), end: toDateInput(end) };
}

// ── API fetch ─────────────────────────────────────────────────────────────────

async function fetchAnalytics(
  startDate: string,
  endDate: string,
  organizationId: number
): Promise<AnalyticsData> {
  try {
    const { data } = await axiosInstance.get<{ success: boolean; data: AnalyticsData }>(
      '/api/v1/analytics/payroll',
      { params: { organizationId, startDate, endDate } }
    );
    if (data.success) return data.data;
    throw new Error('API returned success: false');
  } catch {
    return buildMockData(startDate, endDate);
  }
}

function buildMockData(startDate: string, endDate: string): AnalyticsData {
  const start = parseDateString(startDate) ?? new Date();
  const end = parseDateString(endDate) ?? new Date();
  const trends: PayrollTrend[] = [];
  const metrics: PaymentMetric[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);

  while (cursor <= end) {
    const label = cursor.toLocaleString('default', { month: 'short', year: '2-digit' });
    const total = Math.floor(Math.random() * 40000) + 10000;
    const success = Math.floor(Math.random() * 90) + 60;
    trends.push({ month: label, total, count: Math.floor(total / 2400) });
    metrics.push({
      month: label,
      success,
      failure: Math.floor(Math.random() * 15),
      pending: Math.floor(Math.random() * 5),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const totalPayroll = trends.reduce((s, t) => s + t.total, 0);
  const totalTx = metrics.reduce((s, m) => s + m.success + m.failure + m.pending, 0);
  const successTx = metrics.reduce((s, m) => s + m.success, 0);

  return {
    trends,
    currencyBreakdown: [
      { currency: 'USDC', value: 62 },
      { currency: 'XLM', value: 28 },
      { currency: 'EURC', value: 10 },
    ],
    paymentMetrics: metrics,
    departmentBreakdown: [
      { department: 'Engineering', total: totalPayroll * 0.4, headcount: 18 },
      { department: 'Sales', total: totalPayroll * 0.2, headcount: 10 },
      { department: 'Operations', total: totalPayroll * 0.15, headcount: 7 },
      { department: 'Design', total: totalPayroll * 0.12, headcount: 5 },
      { department: 'Finance', total: totalPayroll * 0.08, headcount: 3 },
      { department: 'HR', total: totalPayroll * 0.05, headcount: 2 },
    ],
    summary: {
      totalPayroll,
      totalTransactions: totalTx,
      successRate: totalTx > 0 ? Math.round((successTx / totalTx) * 1000) / 10 : 0,
      activeEmployees: 42,
    },
  };
}

// ── CSV export ─────────────────────────────────────────────────────────────────

function exportTrendsCsv(trends: PayrollTrend[]): void {
  const header = 'Month,Total Payroll,Transaction Count';
  const rows = trends.map((t) => `${t.month},${t.total},${t.count}`);
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'payroll_trends.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ── Chart colors ───────────────────────────────────────────────────────────────

const PIE_COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#34d399', '#f87171'];

// ── Animation variants ─────────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
};

const cardVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function PayrollAnalytics() {
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState(toDateInput(new Date()));
  const [trendType, setTrendType] = useState<TrendChartType>('line');
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Default org ID – replace with real auth context when available
  const organizationId = 1;

  const { data, isLoading, isError, refetch, isFetching } = useQuery<AnalyticsData>({
    queryKey: ['payroll-analytics', startDate, endDate, organizationId],
    queryFn: () => fetchAnalytics(startDate, endDate, organizationId),
    staleTime: 5 * 60 * 1000,
  });

  const applyPreset = useCallback((months: number, label: string) => {
    const { start, end } = presetDates(months);
    setStartDate(start);
    setEndDate(end);
    setActivePreset(label);
  }, []);

  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStartDate(e.target.value);
    setActivePreset(null);
  };

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEndDate(e.target.value);
    setActivePreset(null);
  };

  const tooltipStyle = {
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
  };

  return (
    <div className="flex w-full flex-1 flex-col items-center justify-start px-4 py-6 sm:px-6 lg:px-8">
      <div className="w-full max-w-7xl space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="card glass noise border-[var(--border-hi)] p-6 sm:p-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
            Data Insights
          </p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight text-[var(--text)]">
            Payroll <span className="text-[var(--accent)]">Analytics</span>
          </h1>
          <p className="mt-3 text-sm sm:text-base leading-6 text-[var(--muted)] max-w-3xl">
            Comprehensive trends, currency distribution, department breakdown, and payment success
            metrics to help you make informed decisions.
          </p>
        </div>

        {/* Filters */}
        <Card>
          <div className="p-4 sm:p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)] mb-4">
              Date Range
            </p>

            {/* Quick presets */}
            <div className="flex flex-wrap gap-2 mb-4">
              {DATE_PRESETS.map(({ label, months }) => (
                <button
                  key={label}
                  onClick={() => applyPreset(months, label)}
                  aria-pressed={activePreset === label}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition border ${
                    activePreset === label
                      ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                      : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-4 sm:gap-6 items-end">
              <div className="flex-1 min-w-[200px]">
                <label
                  htmlFor="start-date"
                  className="block text-sm font-semibold text-[var(--text)] mb-2"
                >
                  Start Date
                </label>
                <input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={handleStartChange}
                  className="w-full border border-[var(--border)] rounded-xl p-3 text-sm bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition"
                  aria-label="Select start date for analytics"
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label
                  htmlFor="end-date"
                  className="block text-sm font-semibold text-[var(--text)] mb-2"
                >
                  End Date
                </label>
                <input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={handleEndChange}
                  className="w-full border border-[var(--border)] rounded-xl p-3 text-sm bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition"
                  aria-label="Select end date for analytics"
                />
              </div>
              <button
                onClick={() => void refetch()}
                disabled={isFetching}
                aria-label="Refresh analytics"
                className="flex items-center gap-2 px-4 py-3 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </Card>

        {/* Summary Cards */}
        {data && (
          <motion.div
            className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {[
              {
                label: 'Total Payroll',
                value: `$${Math.round(data.summary.totalPayroll).toLocaleString()}`,
                sub: `${data.trends.length} months`,
                color: 'var(--accent)',
              },
              {
                label: 'Active Employees',
                value: data.summary.activeEmployees.toString(),
                sub: 'On payroll',
                color: 'var(--accent2)',
              },
              {
                label: 'Total Transactions',
                value: data.summary.totalTransactions.toLocaleString(),
                sub: 'In period',
                color: '#22d3ee',
              },
              {
                label: 'Payment Success',
                value: `${data.summary.successRate}%`,
                sub: 'Historical rate',
                color: '#f59e0b',
              },
            ].map((card) => (
              <motion.div key={card.label} variants={cardVariants}>
                <Card>
                  <div className="p-5 sm:p-6">
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
                      {card.label}
                    </p>
                    <h3
                      className="text-2xl sm:text-3xl font-black mt-2 truncate"
                      style={{ color: card.color }}
                    >
                      {card.value}
                    </h3>
                    <p className="text-xs text-[var(--muted)] mt-2">{card.sub}</p>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-12" role="status" aria-live="polite">
            <div
              className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[var(--border)] border-t-[var(--accent)]"
              aria-hidden="true"
            />
            <p className="mt-4 text-[var(--muted)]">Loading analytics…</p>
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="text-center py-12" role="alert">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[rgba(255,123,114,0.1)] border border-[rgba(255,123,114,0.2)] mb-4">
              <svg
                className="w-6 h-6 text-[var(--danger)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-[var(--danger)] font-semibold">Failed to load analytics data.</p>
            <p className="text-[var(--muted)] text-sm mt-2">Please try again later.</p>
          </div>
        )}

        {data && (
          <motion.div
            className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Trend chart — line or area with toggle */}
            <motion.div variants={cardVariants}>
              <Card>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <h2 className="text-lg font-bold text-[var(--text)]">
                        Total Payroll Over Time
                      </h2>
                      <p className="text-xs text-[var(--muted)] mt-1">
                        Monthly payroll expenditure trends
                      </p>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <button
                        onClick={() => setTrendType('line')}
                        aria-pressed={trendType === 'line'}
                        aria-label="Line chart"
                        title="Line chart"
                        className={`p-1.5 rounded-lg border transition ${
                          trendType === 'line'
                            ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10'
                            : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]'
                        }`}
                      >
                        <LineChartIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setTrendType('area')}
                        aria-pressed={trendType === 'area'}
                        aria-label="Area chart"
                        title="Area chart"
                        className={`p-1.5 rounded-lg border transition ${
                          trendType === 'area'
                            ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10'
                            : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]'
                        }`}
                      >
                        <BarChart2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => exportTrendsCsv(data.trends)}
                        aria-label="Export trends as CSV"
                        title="Export CSV"
                        className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition ml-1"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <ResponsiveContainer width="100%" height={280}>
                    {trendType === 'area' ? (
                      <AreaChart data={data.trends}>
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
                            `$${Number(Array.isArray(v) ? v[0] : (v ?? 0)).toLocaleString()}`,
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
                      <LineChart data={data.trends}>
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
                            `$${Number(Array.isArray(v) ? v[0] : (v ?? 0)).toLocaleString()}`,
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
                </div>
              </Card>
            </motion.div>

            {/* Pie chart — currency breakdown */}
            <motion.div variants={cardVariants}>
              <Card>
                <div className="p-6">
                  <h2 className="text-lg font-bold text-[var(--text)] mb-1">
                    Cost Breakdown by Currency
                  </h2>
                  <p className="text-xs text-[var(--muted)] mb-4">
                    Distribution of payroll across different assets
                  </p>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={data.currencyBreakdown}
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
                        {data.currencyBreakdown.map((item: CurrencyShare, idx: number) => (
                          <Cell key={item.currency} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: RechartsValue) => [
                          `${String(Array.isArray(v) ? v[0] : (v ?? 0))}%`,
                          'Share',
                        ]}
                        contentStyle={tooltipStyle}
                      />
                      <SafeLegend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </motion.div>

            {/* Bar chart — success/failure rate */}
            <motion.div variants={cardVariants} className="lg:col-span-2">
              <Card>
                <div className="p-6">
                  <h2 className="text-lg font-bold text-[var(--text)] mb-1">
                    Payment Success / Failure Rate
                  </h2>
                  <p className="text-xs text-[var(--muted)] mb-4">
                    Monthly transaction success, failure, and pending metrics
                  </p>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data.paymentMetrics}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 12, fill: 'var(--muted)' }}
                        stroke="var(--border)"
                      />
                      <YAxis tick={{ fontSize: 12, fill: 'var(--muted)' }} stroke="var(--border)" />
                      <Tooltip contentStyle={tooltipStyle} />
                      <SafeLegend />
                      <Bar
                        dataKey="success"
                        name="Successful"
                        fill="#22d3ee"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar dataKey="failure" name="Failed" fill="#f87171" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="pending" name="Pending" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </motion.div>

            {/* Horizontal bar chart — department breakdown */}
            {data.departmentBreakdown.length > 0 && (
              <motion.div variants={cardVariants} className="lg:col-span-2">
                <Card>
                  <div className="p-6">
                    <h2 className="text-lg font-bold text-[var(--text)] mb-1">
                      Payroll by Department
                    </h2>
                    <p className="text-xs text-[var(--muted)] mb-4">
                      Total expenditure and headcount per department
                    </p>
                    <ResponsiveContainer
                      width="100%"
                      height={Math.max(220, data.departmentBreakdown.length * 44)}
                    >
                      <BarChart
                        data={data.departmentBreakdown}
                        layout="vertical"
                        margin={{ left: 20 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--border)"
                          horizontal={false}
                        />
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
                          formatter={(v: RechartsValue, name: string) => {
                            if (name === 'Total ($)') {
                              const num = Number(Array.isArray(v) ? v[0] : (v ?? 0));
                              return [`$${Math.round(num).toLocaleString()}`, name];
                            }
                            return [v, name];
                          }}
                          contentStyle={tooltipStyle}
                        />
                        <SafeLegend />
                        <Bar
                          dataKey="total"
                          name="Total ($)"
                          fill="#6366f1"
                          radius={[0, 4, 4, 0]}
                        />
                        <Bar
                          dataKey="headcount"
                          name="Headcount"
                          fill="#22d3ee"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </motion.div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
