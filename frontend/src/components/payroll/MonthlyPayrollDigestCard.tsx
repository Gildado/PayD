/**
 * Monthly Payroll Digest UI Component for Org Admins
 */

import React, { useState } from 'react';
import { fetchMonthlyPayrollDigest } from '../../services/advancedReportApi.js';

export interface MonthlyPayrollDigestCardProps {
  organizationId: number | string;
}

export const MonthlyPayrollDigestCard: React.FC<MonthlyPayrollDigestCardProps> = ({ organizationId }) => {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchMonthlyPayrollDigest({ organizationId, month });
      setReportData(result.data?.[0] || result);
    } catch (err: any) {
      setError(err.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6 max-w-4xl mx-auto my-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">Monthly Payroll Summary Digest</h3>
        <div className="flex items-center space-x-2">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border rounded px-3 py-1 text-sm"
          />
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate Digest'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {reportData && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded">
            <div>
              <p className="text-xs text-gray-500 uppercase">Employees Paid</p>
              <p className="text-xl font-bold">{reportData.summary?.totalEmployeesPaid ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Total Transacted</p>
              <p className="text-xl font-bold">${reportData.summary?.totalAmountTransacted ?? '0.00'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Success Rate</p>
              <p className="text-xl font-bold">{reportData.summary?.overallSuccessRate ?? 100}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Failed Transactions</p>
              <p className="text-xl font-bold text-red-600">{reportData.summary?.failedTransactions ?? 0}</p>
            </div>
          </div>

          {reportData.anomaliesDetected && reportData.anomaliesDetected.length > 0 && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <h4 className="text-sm font-semibold text-yellow-800">Anomalies Detected</h4>
              <ul className="mt-2 text-sm text-yellow-700 list-disc list-inside">
                {reportData.anomaliesDetected.map((anom: any, idx: number) => (
                  <li key={idx}>
                    {anom.employeeId ? `Employee ${anom.employeeId}: ` : ''}{anom.reason} (${anom.amount})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
