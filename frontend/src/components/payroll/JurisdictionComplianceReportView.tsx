/**
 * UI component for org admins to view the Jurisdiction Compliance Report.
 */

import React, { useEffect, useState } from 'react';
import { fetchJurisdictionComplianceReport } from '../../services/jurisdictionComplianceService';

interface Props {
  organizationId: number;
}

export const JurisdictionComplianceReportView: React.FC<Props> = ({ organizationId }) => {
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJurisdictionComplianceReport(organizationId)
      .then((res) => {
        setReportData(res.data?.[0]);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [organizationId]);

  if (loading) return <div>Loading jurisdiction compliance report...</div>;
  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;
  if (!reportData) return <div>No report data available.</div>;

  return (
    <div className="jurisdiction-compliance-report" style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>Jurisdiction Compliance Report</h2>
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
        <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '8px' }}>
          <h4>Total Tax Withheld</h4>
          <p style={{ fontSize: '20px', fontWeight: 'bold' }}>${reportData.summary.totalTaxWithheld}</p>
        </div>
        <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '8px' }}>
          <h4>Pending Remittance</h4>
          <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#d9534f' }}>${reportData.summary.totalPendingRemittance}</p>
        </div>
      </div>

      <h3>Jurisdictions</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
        <thead>
          <tr style={{ background: '#eee', textAlign: 'left' }}>
            <th style={{ padding: '8px', border: '1px solid #ddd' }}>Jurisdiction</th>
            <th style={{ padding: '8px', border: '1px solid #ddd' }}>Withheld</th>
            <th style={{ padding: '8px', border: '1px solid #ddd' }}>Remitted</th>
            <th style={{ padding: '8px', border: '1px solid #ddd' }}>Pending</th>
            <th style={{ padding: '8px', border: '1px solid #ddd' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {reportData.jurisdictions.map((j: any) => (
            <tr key={j.jurisdiction}>
              <td style={{ padding: '8px', border: '1px solid #ddd' }}>{j.jurisdiction}</td>
              <td style={{ padding: '8px', border: '1px solid #ddd' }}>${j.totalWithheld}</td>
              <td style={{ padding: '8px', border: '1px solid #ddd' }}>${j.totalRemitted}</td>
              <td style={{ padding: '8px', border: '1px solid #ddd' }}>${j.pendingRemittance}</td>
              <td style={{ padding: '8px', border: '1px solid #ddd' }}>{j.complianceStatus}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {reportData.recommendations?.length > 0 && (
        <div>
          <h3>Recommendations & Action Items</h3>
          <ul>
            {reportData.recommendations.map((rec: any, idx: number) => (
              <li key={idx} style={{ color: rec.type === 'action' ? '#d9534f' : '#f0ad4e' }}>
                <strong>[{rec.jurisdiction}]</strong> {rec.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
