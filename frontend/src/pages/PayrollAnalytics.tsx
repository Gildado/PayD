import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
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
import { Card } from '@stellar/design-system';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PayrollTrend {
  month: string;
  total: number;
}

interface CurrencyShare {
  currency: string;
  value: number;
}

interface PaymentMetric {
  month: string;
  success: number;
  failure: number;
}

interface AnalyticsData {
  trends: PayrollTrend[];
  currencyBreakdown: CurrencyShare[];
  paymentMetrics: PaymentMetric[];
}

// ── Mock fetch (replace with real API call when endpoint is available) ────────

async function fetchAnalytics(startDate: string, endDate: string): Promise<AnalyticsData> {
  // Simulates an API call — swap for `axios.get('/api/analytics/payroll', { params })`
  await new Promise((r) => setTimeout(r, 300));

  const start = new Date(startDate);
  const end = new Date(endDate);

  const trends: PayrollTrend[] = [];
  const metrics: PaymentMetric[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);

  while (cursor <= end) {
    const label = cursor.toLocaleString('default', { month: 'short', year: '2-digit' });
    trends.push({ month: label, total: Math.floor(Math.random() * 40000) + 10000 });
    metrics.push({
      month: label,
      success: Math.floor(Math.random() * 90) + 60,
      failure: Math.floor(Math.random() * 15),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return {
    trends,
    currencyBreakdown: [
      { currency: 'USDC', value: 62 },
      { currency: 'XLM', value: 28 },
      { currency: 'EURC', value: 10 },
    ],
    paymentMetrics: metrics,
  };
}

// ── Chart colours ─────────────────────────────────────────────────────────────

const PIE_COLORS = ['#6366f1', '#22d3ee', '#f59e0b'];

// ── Component ─────────────────────────────────────────────────────────────────

export default function PayrollAnalytics() {
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState('2026-06-30');

  const { data, isLoading, isError } = useQuery<AnalyticsData>({
    queryKey: ['payroll-analytics', startDate, endDate],
    queryFn: () => fetchAnalytics(startDate, endDate),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Payroll Analytics</h1>
        <p className="text-gray-600">Trends, currency distribution, and payment success metrics.</p>
      </div>

      {/* Date range filter */}
      <Card>
        <div className="p-4 flex flex-wrap gap-6 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-gray-300 rounded-md p-2 text-sm bg-white text-gray-800"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-gray-300 rounded-md p-2 text-sm bg-white text-gray-800"
            />
          </div>
        </div>
      </Card>

      {isLoading && (
        <p className="text-center text-gray-500 py-12">Loading analytics…</p>
      )}

      {isError && (
        <p className="text-center text-red-500 py-12">Failed to load analytics data.</p>
      )}

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Line chart — payroll over time */}
          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">Total Payroll Over Time</h2>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data.trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, 'Total']} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="total"
                    name="Payroll Total"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Pie chart — currency breakdown */}
          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">Cost Breakdown by Currency</h2>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={data.currencyBreakdown}
                    dataKey="value"
                    nameKey="currency"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ currency, value }) => `${currency} ${value}%`}
                  >
                    {data.currencyBreakdown.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`${v}%`, 'Share']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Bar chart — success/failure rate */}
          <Card className="lg:col-span-2">
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">Payment Success / Failure Rate</h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.paymentMetrics}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="success" name="Successful" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="failure" name="Failed" fill="#f87171" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
