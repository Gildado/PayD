import React, { useEffect, useState } from 'react';
import { fetchAnomalySummaryDigest } from '../services/anomalyDigestService.js';

export function AnomalyDigestPage() {
  const [digest, setDigest] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnomalySummaryDigest(1)
      .then(data => {
        setDigest(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-6">Loading Anomaly Summary Digest...</div>;
  if (error) return <div className="p-6 text-red-500">Error: {error}</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Fraud & Anomaly Summary Digest</h1>
      {digest && (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 bg-white shadow rounded">
              <div className="text-gray-500">Total Anomalies</div>
              <div className="text-xl font-bold">{digest.summary.totalAnomalies}</div>
            </div>
            <div className="p-4 bg-white shadow rounded">
              <div className="text-red-500 font-semibold">Critical</div>
              <div className="text-xl font-bold text-red-600">{digest.summary.criticalCount}</div>
            </div>
            <div className="p-4 bg-white shadow rounded">
              <div className="text-yellow-500 font-semibold">Warnings</div>
              <div className="text-xl font-bold text-yellow-600">{digest.summary.warningCount}</div>
            </div>
            <div className="p-4 bg-white shadow rounded">
              <div className="text-blue-500 font-semibold">Info</div>
              <div className="text-xl font-bold text-blue-600">{digest.summary.infoCount}</div>
            </div>
          </div>
          <div className="bg-white p-6 shadow rounded">
            <h2 className="text-lg font-semibold mb-2">Recommendations</h2>
            <ul className="list-disc pl-5 space-y-1">
              {digest.recommendations?.map((rec: any, idx: number) => (
                <li key={idx} className={rec.type === 'warning' ? 'text-red-600 font-medium' : 'text-gray-700'}>
                  {rec.message}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
