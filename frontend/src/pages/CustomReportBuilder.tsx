import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { Button, Card } from '@stellar/design-system';
import {
  AlertTriangle,
  CalendarRange,
  Check,
  Clock,
  ExternalLink,
  FileDown,
  GripVertical,
  LayoutGrid,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react';
import { useNotification } from '../hooks/useNotification';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { getTxExplorerUrl } from '../utils/stellarExpert';
import {
  MAX_CUSTOM_EXPORT_ROWS,
  PAYROLL_EXPORT_COLUMNS,
  PAYROLL_EXPORT_FORMATS,
  exportCustomPayrollReport,
  fetchPayrollPreview,
  loadExportHistory,
  recordExportHistoryEntry,
  resolveOrganizationPublicKey,
  saveOrganizationPublicKey,
  triggerDownload,
  type ExportHistoryEntry,
  type PayrollExportColumnId,
  type PayrollExportFormat,
  type PayrollTransactionRecord,
} from '../services/customReportExport';
import {
  buildManualExportCsv,
  computeFreshnessFromRows,
  type FreshnessIndicator,
} from '../services/reportAgentUi';
import {
  executeNaturalLanguagePayrollQuery,
  type NaturalLanguageQueryResponse,
} from '../services/payrollNaturalLanguageQueryService';

function getDefaultStartDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().slice(0, 10);
}

function getDefaultEndDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatCurrency(amount?: string, assetCode?: string): string {
  if (!amount) return '—';
  const parsed = Number.parseFloat(amount);
  const formatted = Number.isFinite(parsed)
    ? parsed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 7 })
    : amount;
  return assetCode ? `${formatted} ${assetCode}` : formatted;
}

function formatCell(row: PayrollTransactionRecord, columnId: PayrollExportColumnId): string {
  switch (columnId) {
    case 'txHash':
      return row.txHash;
    case 'employeeId':
      return row.employeeId || '—';
    case 'payrollBatchId':
      return row.payrollBatchId || '—';
    case 'itemType':
      return row.itemType === 'bonus' ? 'Bonus' : 'Base Salary';
    case 'amount':
      return formatCurrency(row.amount, row.assetCode);
    case 'assetCode':
      return row.assetCode || 'Native';
    case 'assetIssuer':
      return row.assetIssuer || '—';
    case 'status':
      return row.successful ? 'Success' : 'Failed';
    case 'timestamp':
      return new Date(row.timestamp * 1000).toLocaleString();
    case 'memo':
      return row.memo || '—';
    case 'sourceAccount':
      return row.sourceAccount || '—';
    case 'destAccount':
      return row.destAccount || '—';
    case 'ledgerHeight':
      return String(row.ledgerHeight ?? '—');
    case 'fee':
      return row.fee || '—';
    case 'description':
      return row.description || '—';
    default:
      return '—';
  }
}

function formatStatusTone(successful: boolean): string {
  return successful
    ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200'
    : 'border-rose-400/25 bg-rose-400/10 text-rose-200';
}

const FRESHNESS_TONE_CLASSES: Record<FreshnessIndicator['tone'], string> = {
  success: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
  warning: 'border-amber-400/25 bg-amber-400/10 text-amber-100',
  danger: 'border-rose-400/25 bg-rose-400/10 text-rose-200',
};

const DEFAULT_SELECTED_COLUMNS: PayrollExportColumnId[] = PAYROLL_EXPORT_COLUMNS.map(
  (column) => column.id
);

export default function CustomReportBuilder() {
  const { notifyError, notifySuccess } = useNotification();
  const [organizationPublicKey, setOrganizationPublicKey] = useState('');
  const [startDate, setStartDate] = useState(() => getDefaultStartDate());
  const [endDate, setEndDate] = useState(() => getDefaultEndDate());
  const [selectedColumns, setSelectedColumns] =
    useState<PayrollExportColumnId[]>(DEFAULT_SELECTED_COLUMNS);
  const [format, setFormat] = useState<PayrollExportFormat>('excel');
  const [reportName, setReportName] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportHistory, setExportHistory] = useState<ExportHistoryEntry[]>([]);

  // Natural language query state
  const [naturalQuery, setNaturalQuery] = useState('');
  const [nlResult, setNlResult] = useState<NaturalLanguageQueryResponse | null>(null);

  useEffect(() => {
    const savedKey = resolveOrganizationPublicKey();
    if (savedKey) setOrganizationPublicKey(savedKey);
    setExportHistory(loadExportHistory());
  }, []);

  const previewQuery = useQuery({
    queryKey: ['payrollPreview', organizationPublicKey, startDate, endDate],
    queryFn: () => fetchPayrollPreview(organizationPublicKey, startDate, endDate, 1, 50),
    enabled: Boolean(organizationPublicKey),
  });

  const rows = previewQuery.data?.data.data ?? [];
  const freshness = useMemo(() => computeFreshnessFromRows(rows), [rows]);

  const handleNlQuerySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!naturalQuery.trim()) return;
    const res = executeNaturalLanguagePayrollQuery({
      query: naturalQuery,
      records: rows,
    });
    setNlResult(res);
    notifySuccess('Natural language report generated', res.summaryText);
  };

  const handleExportCustom = async () => {
    if (!organizationPublicKey) {
      notifyError('Organization public key is required');
      return;
    }
    setIsExporting(true);
    try {
      const blob = await exportCustomPayrollReport({
        organizationPublicKey,
        startDate,
        endDate,
        format,
        columns: selectedColumns,
        reportName,
      });
      const ext = format === 'csv' ? 'csv' : format === 'excel' ? 'xlsx' : 'pdf';
      const filename = `${reportName.trim() || 'payroll-custom-report'}.${ext}`;
      triggerDownload(blob, filename);
      saveOrganizationPublicKey(organizationPublicKey);

      const entry = recordExportHistoryEntry({
        filename,
        format,
        rowCount: rows.length,
        columns: selectedColumns,
        organizationPublicKey,
      });
      setExportHistory(loadExportHistory());
      notifySuccess('Report exported successfully', `Downloaded ${filename} (${rows.length} rows)`);
    } catch (err: unknown) {
      // Fallback to client-side CSV export if backend fails
      const fallbackCsv = buildManualExportCsv(rows, selectedColumns);
      const blob = new Blob([fallbackCsv], { type: 'text/csv;charset=utf-8;' });
      triggerDownload(blob, 'payroll-custom-fallback.csv');
      notifySuccess('Export fallback used', 'Downloaded client-side CSV fallback');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Custom Report Builder & Payroll AI
          </h1>
          <p className="text-gray-600 mt-1">
            Build custom reports or query your payroll data using natural language.
          </p>
        </div>
        {rows.length > 0 && (
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${FRESHNESS_TONE_CLASSES[freshness.tone]}`}>
            <Clock className="w-3.5 h-3.5" />
            <span>{freshness.label}: {freshness.description}</span>
          </div>
        )}
      </div>

      {/* Natural Language Query Interface Card */}
      <Card>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <h2 className="text-xl font-semibold text-gray-900">Natural-Language Payroll Query Assistant</h2>
          </div>
          <p className="text-sm text-gray-600">
            Ask questions in plain language (e.g., &quot;show failed transactions&quot;, &quot;show USDC payouts&quot;, &quot;search EMP-001&quot;).
          </p>
          <form onSubmit={handleNlQuerySubmit} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <input
                type="text"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Ask about payroll data..."
                value={naturalQuery}
                onChange={(e) => setNaturalQuery(e.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary">
              Generate Report
            </Button>
          </form>

          {nlResult && (
            <div className="mt-4 p-4 bg-indigo-50/50 border border-indigo-100 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-indigo-900">Agent Report Result</span>
                <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">
                  {nlResult.matchedCount} matches
                </span>
              </div>
              <p className="text-sm text-indigo-700">{nlResult.summaryText}</p>
              {nlResult.aggregates && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-indigo-200/50 text-xs">
                  <div>
                    <span className="text-gray-500 block">Total Amount:</span>
                    <span className="font-bold text-gray-900">
                      {nlResult.aggregates.totalAmount?.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Successful:</span>
                    <span className="font-bold text-emerald-600">
                      {nlResult.aggregates.successCount}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Failed:</span>
                    <span className="font-bold text-rose-600">
                      {nlResult.aggregates.failedCount}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Schema Version:</span>
                    <span className="font-semibold text-gray-700">{nlResult.schemaVersion}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Existing Custom Report Config Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <div className="p-6 space-y-4">
            <h3 className="font-semibold text-lg text-gray-900">Export Settings</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Organization Public Key</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                value={organizationPublicKey}
                onChange={(e) => setOrganizationPublicKey(e.target.value)}
                placeholder="G..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Report Name</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
                placeholder="Monthly Payroll"
              />
            </div>
            <Button
              onClick={handleExportCustom}
              disabled={isExporting || !organizationPublicKey}
              className="w-full"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileDown className="w-4 h-4 mr-2" />}
              Export Report
            </Button>
          </div>
        </Card>

        <Card className="md:col-span-2">
          <div className="p-6 space-y-4">
            <h3 className="font-semibold text-lg text-gray-900">Preview Records ({rows.length})</h3>
            {previewQuery.isLoading ? (
              <SkeletonLoader variant="table-row" count={5} />
            ) : rows.length === 0 ? (
              <p className="text-sm text-gray-500">Enter an organization public key to preview data.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-gray-500">
                      <th className="pb-2 font-medium">Tx Hash</th>
                      <th className="pb-2 font-medium">Employee</th>
                      <th className="pb-2 font-medium">Amount</th>
                      <th className="pb-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.slice(0, 10).map((r) => (
                      <tr key={r.txHash}>
                        <td className="py-2 font-mono text-xs text-indigo-600">
                          {r.txHash.slice(0, 10)}...
                        </td>
                        <td className="py-2">{r.employeeId || '—'}</td>
                        <td className="py-2 font-medium">{formatCurrency(r.amount, r.assetCode)}</td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${formatStatusTone(r.successful)}`}>
                            {r.successful ? 'Success' : 'Failed'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
