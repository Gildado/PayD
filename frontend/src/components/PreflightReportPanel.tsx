import React from 'react';
import type { ValidationReport } from '../services/stellarValidation';
import { Button, Heading, Text, Icon } from '@stellar/design-system';

interface Props {
  report: ValidationReport;
  onRetry: () => void;
}

export const PreflightReportPanel: React.FC<Props> = ({ report, onRetry }) => {
  if (report.success) return null;

  const handleDownloadCsv = () => {
    const rows = [
      ['Employee Name', 'Wallet Address', 'Account Exists', 'Missing Trustlines', 'Status'],
    ];

    report.employeeResults.forEach((emp) => {
      if (!emp.success) {
        rows.push([
          emp.name,
          emp.walletAddress || 'N/A',
          emp.accountExists ? 'Yes' : 'No',
          emp.missingTrustlines.join(' '),
          'Failed',
        ]);
      }
    });

    const csvContent = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'failed_preflight_checks.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="card glass noise border border-danger/30 mt-4">
      <Heading as="h3" size="xs" weight="bold" addlClassName="mb-3 flex items-center gap-2 text-danger">
        <Icon.Warning size="sm" /> Preflight Validation Failed
      </Heading>
      
      {!report.orgHasSufficientXlm && (
        <div className="mb-4 p-3 bg-danger/10 border border-danger/20 rounded">
          <Text as="p" size="sm" weight="bold" addlClassName="text-danger">Organization Wallet Insufficient XLM</Text>
          <Text as="p" size="xs" addlClassName="text-muted mt-1">
            Required: {report.requiredXlm.toFixed(2)} XLM | Available: {report.orgXlmBalance.toFixed(2)} XLM
          </Text>
        </div>
      )}

      {report.employeeResults.filter(r => !r.success).length > 0 && (
        <div className="mb-4">
          <Text as="p" size="sm" weight="bold" addlClassName="mb-2">Employee Account Issues:</Text>
          <ul className="text-sm space-y-2">
            {report.employeeResults.filter(r => !r.success).map(emp => (
              <li key={emp.id} className="p-3 bg-black/20 rounded border border-hi">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold">{emp.name}</span>
                  <span className="font-mono text-xs text-muted truncate max-w-[150px]">{emp.walletAddress || 'No Wallet Provided'}</span>
                </div>
                {!emp.accountExists && <div className="text-danger text-xs mt-1">• Account does not exist on-chain</div>}
                {emp.missingTrustlines.length > 0 && (
                  <div className="text-danger text-xs mt-1">• Missing trustlines: {emp.missingTrustlines.join(', ')}</div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-3 mt-4">
        <Button size="sm" variant="secondary" onClick={handleDownloadCsv}>
          Download Errors (CSV)
        </Button>
        <Button size="sm" variant="primary" onClick={onRetry}>
          Retry Validation
        </Button>
      </div>
    </div>
  );
};
