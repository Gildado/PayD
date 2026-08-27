import React, { useState, useCallback, useRef } from 'react';
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
import {
  BarChart2,
  LineChart as LineChartIcon,
  Download,
  RefreshCw,
  FileImage,
  Sparkles,
} from 'lucide-react';
import axiosInstance from '../api/axiosInstance';
import { parseDateString } from '../utils/dateHelpers';
import { exportAsPng, exportAsSvg } from '../utils/exportChart';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { useReducedMotion } from '../hooks/useReducedMotion';

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

interface ForecastReport {
  reportName: string;
  generatedAt: string;
  summary: {
    currentTotalPayroll: number;
    forecastedNextMonthPayroll: number;
    expectedHeadcount: number;
    growthRatePercentage: number;
    confidenceScore: number;
  };
  recommendations: string[];
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

async function fetchForecastReport(organizationId: number): Promise<ForecastReport> {
  try {
    const { data } = await axiosInstance.get<{ success: boolean; data: ForecastReport }>(
      '/api/v1/reports/payroll-cost-forecast',
      { params: { organizationId } }
    );
    if (data.success) return data.data;
    throw new Error('API returned success: false');
  } catch {
    return {
      reportName: 'Payroll Cost Forecast Report',
      generatedAt: new Date().toISOString(),
      summary: {
        currentTotalPayroll: 125000,
        forecastedNextMonthPayroll: 138500,
        expectedHeadcount: 45,
        growthRatePercentage: 10.8,
        confidenceScore: 0.92,
      },
      recommendations: [
        'Engineering headcount expansion is driving 52% of the projected cost increase.',
        'Consider locking in USDC stablecoin conversion rates ahead of the next cycle.',
      ],
    };
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
      { department: 'Engineering', total: Math.floor(totalPayroll * 0.5), headcount: 18 },
      { department: 'Product', total: Math.floor(totalPayroll * 0.2), headcount: 8 },
      { department: 'Operations', total: Math.floor(totalPayroll * 0.2), headcount: 10 },
      { department: 'Marketing', total: Math.floor(totalPayroll * 0.1), headcount: 6 },
    ],
    summary: {
      totalPayroll,
      totalTransactions: totalTx,
      successRate: totalTx > 0 ? Number(((successTx / totalTx) * 100).toFixed(1)) : 98.5,
      activeEmployees: 42,
    },
  };
}

// ── CSV Export ────────────────────────────────────────────────────────────────

export function exportDashboardCsv(data: AnalyticsData):
 void {
  const rows: string[] = [
    'Section,Metric/Dimension,Value',
    `Summary,Total Payroll,${data.summary.totalPayroll}`,
    `Summary,Total Transactions,${data.summary.totalTransactions}`,
    `Summary,Success Rate (%),${data.summary.successRate}`,
    `Summary,Active Employees,${data.summary.activeEmployees}`,
  ];

  data.trends.forEach((t) => {
    rows.push(`Trend,${t.month} - Total,${t.total}`);
    rows.push(`Trend,${t.month} - Count,${t.count}`);
  });

  data.currencyBreakdown.forEach((c) => {
    rows.push(`CurrencyBreakdown,${c.currency},${c.value}`);
  });

  data.departmentBreakdown.forEach((d) => {
    rows.push(`Department,${d.department} - Total,${d.total}`);
    rows.push(`Department,${d.department} - Headcount,${d.headcount}`);
  });

  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `payroll-analytics-${toDateInput(new Date())}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Component ─────────────────────────────────────────────────────────────────

const COLORS = ['var(--chart-1, #3b82f6)', 'var(--chart-2, #10b981)', 'var(--chart-3, #f59e0b)', 'var(--chart-4, #ef4444)'];

export default function PayrollAnalytics() {
  const [orgId] = useState<number>(1);
  const defaultRange = presetDates(6);
  const [startDate, setStartDate] = useState<string>(defaultRange.start);
  const [endDate, setEndDate] = useState<string>(defaultRange.end);
  const [activePreset, setActivePreset] = useState<number | null>(6);
  const [trendChartType, setTrendChartType] = useState<TrendChartType>('line');
  const [showForecastModal, setShowForecastModal] = useState<boolean>(false);

  const trendCardRef = useRef<HTMLDivElement>(null);
  const currencyCardRef = useRef<HTMLDivElement>(null);
  const paymentCardRef = useRef<HTMLDivElement>(null);
  const deptCardRef = useRef<HTMLDivElement>(null);

  const reduceMotion = useReducedMotion();

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['payrollAnalytics', startDate, endDate, orgId],
    queryFn: () => fetchAnalytics(startDate, endDate, orgId),
    staleTime: 5 * 60 * 1000,
  });

  const forecastQuery = useQuery({
    queryKey: ['payrollForecastReport', orgId],
    queryFn: () => fetchForecastReport(orgId),
    enabled: showForecastModal,
  });

  const handlePresetClick = (months: number) => {
    setActivePreset(months);
    const range = presetDates(months);
    setStartDate(range.start);
    setEndDate(range.end);
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setActivePreset(null);
    setStartDate(e.target.value);
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setActivePreset(null);
    setEndDate(e.target.value);
  };

  const activeData = data ?? buildMockData(startDate, endDate);

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Payroll <span className="text-blue-600 dark:text-blue-400">Analytics</span>
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Monitor payroll trends, currency allocation, and department distributions on Stellar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Forecast Agent Report Button */}
          <button
            onClick={() => setShowForecastModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-sm transition-all"
            aria-label="Generate Payroll Cost Forecast Report"
          >
            <Sparkles className="w-4 h-4" />
            Cost Forecast Agent
          </button>

          {/* Presets */}
          <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handlePresetClick(preset.months)}
                aria-pressed={activePreset === preset.months}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  activePreset === preset.months
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Date Pickers */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              aria-label="Select start date for analytics"
              value={startDate}
              onChange={handleStartDateChange}
              className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              aria-label="Select end date for analytics"
              value={endDate}
              onChange={handleEndDateChange}
              className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
          </div>

          {/* Refresh */}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Refresh analytics"
            className="p-2 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>

          {/* Export Full Dashboard CSV */}
          <button
            onClick={() => exportDashboardCsv(activeData)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-white"
          >
            <Download className="w-3.5 h-3.5" />
            Export Full Dashboard as CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonLoader key={i} variant="card" height={20} reducedMotion={reduceMotion} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <div className="p-4">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Payroll</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                ${activeData.summary.totalPayroll.toLocaleString()}
              </p>
            </div>
          </Card>
          <Card>
            <div className="p-4">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Transactions</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {activeData.summary.totalTransactions.toLocaleString()}
              </p>
            </div>
          </Card>
          <Card>
            <div className="p-4">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Success Rate</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {activeData.summary.successRate}%
              </p>
            </div>
          </Card>
          <Card>
            <div className="p-4">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Active Employees</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {activeData.summary.activeEmployees.toLocaleString()}
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend Chart */}
        <Card>
          <div className="p-5" ref={trendCardRef}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Payroll Cost Trend</h2>
                <p className="text-xs text-gray-500">Historical outlays over time</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5">
                  <button
                    onClick={() => setTrendChartType('line')}
                    aria-label="Line chart"
                    aria-pressed={trendChartType === 'line'}
                    className={`p-1.5 rounded-md ${trendChartType === 'line' ? 'bg-white dark:bg-gray-700 shadow-sm' : ''}`}
                  >
                    <LineChartIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setTrendChartType('area')}
                    aria-label="Area chart"
                    aria-pressed={trendChartType === 'area'}
                    className={`p-1.5 rounded-md ${trendChartType === 'area' ? 'bg-white dark:bg-gray-700 shadow-sm' : ''}`}
                  >
                    <BarChart2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button
                  onClick={() => exportAsPng(trendCardRef.current!, 'payroll-trend.png')}
                  title="Export as PNG"
                  className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-900 dark:hover:text-white"
                >
                  <FileImage className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => exportAsSvg(trendCardRef.current!, 'payroll-trend.svg')}
                  title="Export as SVG"
                  className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-900 dark:hover:text-white"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {trendChartType === 'line' ? (
                  <LineChart data={activeData.trends}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <SafeLegend />
                    <Line type="monotone" dataKey="total" stroke="var(--chart-1, #3b82f6)" strokeWidth={2} name="Total Cost ($)" />
                  </LineChart>
                ) : (
                  <AreaChart data={activeData.trends}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <SafeLegend />
                    <Area type="monotone" dataKey="total" stroke="var(--chart-1, #3b82f6)" fill="var(--chart-1, #3b82f6)" fillOpacity={0.2} name="Total Cost ($)" />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        {/* Currency Breakdown */}
        <Card>
          <div className="p-5" ref={currencyCardRef}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Currency Breakdown</h2>
                <p className="text-xs text-gray-500">Distribution by asset code</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportAsPng(currencyCardRef.current!, 'currency-breakdown.png')}
                  title="Export as PNG"
                  className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-900 dark:hover:text-white"
                >
                  <FileImage className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => exportAsSvg(currencyCardRef.current!, 'currency-breakdown.svg')}
                  title="Export as SVG"
                  className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-900 dark:hover:text-white"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={activeData.currencyBreakdown}
                    dataKey="value"
                    nameKey="currency"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(props: PieLabelRenderProps) => `${props.name ?? ''}: ${props.value ?? 0}%`}
                  >
                    {activeData.currencyBreakdown.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <SafeLegend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        {/* Payment Metrics */}
        <Card>
          <div className="p-5" ref={paymentCardRef}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Transaction Status Metrics</h2>
                <p className="text-xs text-gray-500">Success vs failure breakdown</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportAsPng(paymentCardRef.current!, 'payment-metrics.png')}
                  title="Export as PNG"
                  className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-900 dark:hover:text-white"
                >
                  <FileImage className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => exportAsSvg(paymentCardRef.current!, 'payment-metrics.svg')}
                  title="Export as SVG"
                  className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-900 dark:hover:text-white"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activeData.paymentMetrics}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <SafeLegend />
                  <Bar dataKey="success" fill="#10b981" name="Successful" />
                  <Bar dataKey="failure" fill="#ef4444" name="Failed" />
                  <Bar dataKey="pending" fill="#f59e0b" name="Pending" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        {/* Department Breakdown */}
        <Card>
          <div className="p-5" ref={deptCardRef}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Department Cost Distribution</h2>
                <p className="text-xs text-gray-500">Cost by department</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportAsPng(deptCardRef.current!, 'department-breakdown.png')}
                  title="Export as PNG"
                  className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-900 dark:hover:text-white"
                >
                  <FileImage className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => exportAsSvg(deptCardRef.current!, 'department-breakdown.svg')}
                  title="Export as SVG"
                  className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-900 dark:hover:text-white"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activeData.departmentBreakdown} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="department" type="category" tick={{ fontSize: 12 }} width={90} />
                  <Tooltip />
                  <SafeLegend />
                  <Bar dataKey="total" fill="var(--chart-2, #10b981)" name="Total Cost ($)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      </div>

      {/* Cost Forecast Agent Modal / Report Dialog */}
      {showForecastModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-2xl w-full p-6 space-y-6 border border-gray-200 dark:border-gray-800"
          >
            <div className="flex items-center justify-between border-b pb-4 border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Payroll Cost Forecast Agent</h3>
              </div>
              <button
                onClick={() => setShowForecastModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            {forecastQuery.isLoading ? (
              <div className="py-12 flex justify-center">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : forecastQuery.data ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <div>
                    <p className="text-xs text-gray-500">Current Total Payroll</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      ${forecastQuery.data.summary.currentTotalPayroll.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Forecasted Next Month</p>
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      ${forecastQuery.data.summary.forecastedNextMonthPayroll.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Expected Headcount</p>
                    <p className="text-base font-semibold text-gray-900 dark:text-white">
                      {forecastQuery.data.summary.expectedHeadcount} employees
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Confidence Score</p>
                    <p className="text-base font-semibold text-emerald-600 dark:text-emerald-400">
                      {(forecastQuery.data.summary.confidenceScore * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Agent Insights & Recommendations</h4>
                  <ul className="space-y-2">
                    {forecastQuery.data.recommendations.map((rec, idx) => (
                      <li key={idx} className="text-xs bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 p-3 rounded-lg flex items-start gap-2">
                        <span className="font-bold">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-sm text-red-500">Failed to generate forecast report.</p>
            )}

            <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-800">
              <button
                onClick={() => setShowForecastModal(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
