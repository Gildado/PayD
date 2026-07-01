import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { Button, Card } from '@stellar/design-system';
import {
  CalendarRange,
  Check,
  ExternalLink,
  FileDown,
  GripVertical,
  LayoutGrid,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useNotification } from '../hooks/useNotification';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { getTxExplorerUrl } from '../utils/stellarExpert';
import {
  PAYROLL_EXPORT_COLUMNS,
  PAYROLL_EXPORT_FORMATS,
  exportCustomPayrollReport,
  fetchPayrollPreview,
  resolveOrganizationPublicKey,
  saveOrganizationPublicKey,
  triggerDownload,
  type PayrollExportColumnId,
  type PayrollExportFormat,
  type PayrollTransactionRecord,
} from '../services/customReportExport';

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

const DEFAULT_SELECTED_COLUMNS: PayrollExportColumnId[] = PAYROLL_EXPORT_COLUMNS.map(
  (column) => column.id
);

export default function CustomReportBuilder() {
  const { notifyError, notifySuccess, notifyApiError } = useNotification();
  const [organizationPublicKey, setOrganizationPublicKey] = useState('');
  const [startDate, setStartDate] = useState(() => getDefaultStartDate());
  const [endDate, setEndDate] = useState(() => getDefaultEndDate());
  const [selectedColumns, setSelectedColumns] =
    useState<PayrollExportColumnId[]>(DEFAULT_SELECTED_COLUMNS);
  const [format, setFormat] = useState<PayrollExportFormat>('excel');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const storedOrgPublicKey = resolveOrganizationPublicKey();
    if (storedOrgPublicKey) {
      setOrganizationPublicKey(storedOrgPublicKey);
    }
  }, []);

  useEffect(() => {
    const trimmed = organizationPublicKey.trim();
    if (trimmed) {
      saveOrganizationPublicKey(trimmed);
    }
  }, [organizationPublicKey]);

  const columnById = useMemo(() => {
    return new Map(PAYROLL_EXPORT_COLUMNS.map((column) => [column.id, column] as const));
  }, []);

  const selectedColumnMeta = useMemo(
    () =>
      selectedColumns
        .map((id) => columnById.get(id))
        .filter((column): column is (typeof PAYROLL_EXPORT_COLUMNS)[number] => Boolean(column)),
    [columnById, selectedColumns]
  );

  const availableColumns = useMemo(
    () => PAYROLL_EXPORT_COLUMNS.filter((column) => !selectedColumns.includes(column.id)),
    [selectedColumns]
  );

  const previewQuery = useQuery({
    queryKey: ['custom-payroll-preview', organizationPublicKey, startDate, endDate],
    enabled: Boolean(organizationPublicKey.trim()),
    queryFn: async () =>
      fetchPayrollPreview({
        organizationPublicKey: organizationPublicKey.trim(),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page: 1,
        limit: 50,
      }),
    staleTime: 30_000,
    retry: 1,
  });

  const previewRows = previewQuery.data?.data || [];
  const totalRows = previewQuery.data?.total || 0;
  const isPreviewing = previewQuery.isLoading || previewQuery.isFetching;

  const handleColumnToggle = (columnId: PayrollExportColumnId) => {
    setSelectedColumns((current) =>
      current.includes(columnId) ? current.filter((id) => id !== columnId) : [...current, columnId]
    );
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;
    if (sourceIndex === destinationIndex) return;

    setSelectedColumns((current) => {
      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(destinationIndex, 0, moved);
      return next;
    });
  };

  const selectAllColumns = () => {
    setSelectedColumns(DEFAULT_SELECTED_COLUMNS);
  };

  const clearColumns = () => {
    setSelectedColumns([]);
  };

  const handleExport = async () => {
    const trimmedOrgKey = organizationPublicKey.trim();
    if (!trimmedOrgKey) {
      notifyError('Missing organization key', 'Paste an organization public key to export data.');
      return;
    }

    if (selectedColumns.length === 0) {
      notifyError('No columns selected', 'Choose at least one column before exporting.');
      return;
    }

    setIsExporting(true);
    try {
      const { blob, filename } = await exportCustomPayrollReport({
        organizationPublicKey: trimmedOrgKey,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        format,
        columns: selectedColumns,
      });

      triggerDownload(blob, filename);
      notifySuccess('Export ready', `${filename} has been downloaded.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed';
      notifyApiError('Export failed', message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="page-fade relative min-h-full overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute left-0 top-24 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(10,14,20,0.96),rgba(20,28,40,0.88))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-(--muted)">
                <LayoutGrid className="h-3.5 w-3.5 text-(--accent)" />
                Custom Payroll Export Builder
              </div>
              <div className="space-y-3">
                <h1 className="text-3xl font-black tracking-tight text-(--text) sm:text-5xl">
                  Shape the export, then ship the file.
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-(--muted) sm:text-base">
                  Pick the columns, range, and format you need. The preview updates live from the
                  payroll API, and the final export is generated by the backend so admins download
                  the exact dataset they reviewed.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[34rem]">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-(--muted)">
                  Preview rows
                </p>
                <p className="mt-2 text-2xl font-black text-(--text)">{previewRows.length}</p>
                <p className="text-xs text-(--muted)">Returned from the live payroll query</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-(--muted)">
                  Selected columns
                </p>
                <p className="mt-2 text-2xl font-black text-(--text)">{selectedColumns.length}</p>
                <p className="text-xs text-(--muted)">Drag to reorder the export layout</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-(--muted)">
                  Export format
                </p>
                <p className="mt-2 text-2xl font-black text-(--text)">
                  {PAYROLL_EXPORT_FORMATS.find((item) => item.value === format)?.label}
                </p>
                <p className="text-xs text-(--muted)">Backend-generated download</p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(340px,420px)_minmax(0,1fr)]">
          <aside className="space-y-6">
            <Card>
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-(--text)">Organization</h2>
                    <p className="text-sm text-(--muted)">
                      The backend export uses this public key to scope the report.
                    </p>
                  </div>
                  <Search className="h-5 w-5 text-(--accent2)" />
                </div>
                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-(--muted)">
                    Organization public key
                  </span>
                  <input
                    type="text"
                    value={organizationPublicKey}
                    onChange={(event) => setOrganizationPublicKey(event.target.value)}
                    placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 font-mono text-sm text-(--text) outline-none transition focus:border-(--accent)/40 focus:bg-black/25"
                  />
                </label>
                <p className="text-xs leading-5 text-(--muted)">
                  If you have already saved your organization key elsewhere in the app, it will be
                  restored automatically here.
                </p>
              </div>
            </Card>

            <Card>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <CalendarRange className="h-5 w-5 text-(--accent)" />
                  <div>
                    <h2 className="text-lg font-bold text-(--text)">Date Range</h2>
                    <p className="text-sm text-(--muted)">
                      Narrow the live preview and the export to the target window.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-(--muted)">
                      Start date
                    </span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-(--text) outline-none transition focus:border-(--accent)/40 focus:bg-black/25"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-(--muted)">
                      End date
                    </span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-(--text) outline-none transition focus:border-(--accent)/40 focus:bg-black/25"
                    />
                  </label>
                </div>
              </div>
            </Card>

            <Card>
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-(--text)">Format</h2>
                    <p className="text-sm text-(--muted)">
                      Choose how the backend should package the file.
                    </p>
                  </div>
                  <FileDown className="h-5 w-5 text-(--accent2)" />
                </div>

                <div className="grid gap-3">
                  {PAYROLL_EXPORT_FORMATS.map((item) => {
                    const active = format === item.value;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setFormat(item.value)}
                        className={`rounded-2xl border px-4 py-3 text-left transition ${
                          active
                            ? 'border-(--accent)/40 bg-(--accent)/10 shadow-[0_0_0_1px_rgba(74,240,184,0.08)]'
                            : 'border-white/10 bg-black/20 hover:border-white/20 hover:bg-black/25'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-(--text)">{item.label}</p>
                            <p className="text-xs text-(--muted)">{item.description}</p>
                          </div>
                          <div
                            className={`grid h-5 w-5 place-items-center rounded-full border ${
                              active
                                ? 'border-(--accent) bg-(--accent) text-black'
                                : 'border-white/20 text-transparent'
                            }`}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </Card>

            <Card>
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-(--text)">Columns</h2>
                    <p className="text-sm text-(--muted)">
                      Use the checkbox list, then drag selected columns to reorder the export.
                    </p>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-(--muted)">
                    {selectedColumns.length}/{PAYROLL_EXPORT_COLUMNS.length}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={selectAllColumns}>
                    Select all
                  </Button>
                  <Button variant="secondary" size="sm" onClick={clearColumns}>
                    Clear
                  </Button>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-(--muted)">
                      Selected order
                    </p>

                    <DragDropContext onDragEnd={handleDragEnd}>
                      <Droppable droppableId="selected-columns">
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className="space-y-2"
                          >
                            {selectedColumnMeta.length > 0 ? (
                              selectedColumnMeta.map((column, index) => (
                                <Draggable key={column.id} draggableId={column.id} index={index}>
                                  {(dragProvided, snapshot) => (
                                    <div
                                      ref={dragProvided.innerRef}
                                      {...dragProvided.draggableProps}
                                      className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 transition ${
                                        snapshot.isDragging
                                          ? 'border-(--accent)/50 bg-(--accent)/10 shadow-lg'
                                          : 'border-white/10 bg-white/5'
                                      }`}
                                    >
                                      <div className="flex items-center gap-3">
                                        <button
                                          type="button"
                                          {...dragProvided.dragHandleProps}
                                          className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-black/20 text-(--muted)"
                                          aria-label={`Reorder ${column.label}`}
                                        >
                                          <GripVertical className="h-4 w-4" />
                                        </button>
                                        <div>
                                          <p className="text-sm font-semibold text-(--text)">
                                            {column.label}
                                          </p>
                                          <p className="text-[11px] text-(--muted)">
                                            {column.description}
                                          </p>
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleColumnToggle(column.id)}
                                        className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-(--muted) transition hover:border-white/20 hover:text-(--text)"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  )}
                                </Draggable>
                              ))
                            ) : (
                              <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-(--muted)">
                                Select at least one column to build the export.
                              </div>
                            )}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </DragDropContext>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-(--muted)">
                      Available columns
                    </p>
                    <div className="grid gap-2">
                      {availableColumns.map((column) => (
                        <label
                          key={column.id}
                          className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 transition hover:border-white/20 hover:bg-white/10"
                        >
                          <input
                            type="checkbox"
                            checked={selectedColumns.includes(column.id)}
                            onChange={() => handleColumnToggle(column.id)}
                            className="mt-1 h-4 w-4 rounded border-white/20 bg-black/20 text-(--accent)"
                          />
                          <span>
                            <span className="block text-sm font-semibold text-(--text)">
                              {column.label}
                            </span>
                            <span className="block text-[11px] leading-5 text-(--muted)">
                              {column.description}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <Button
              onClick={() => void handleExport()}
              variant="primary"
              size="md"
              className="w-full justify-center"
              disabled={
                isExporting || selectedColumns.length === 0 || !organizationPublicKey.trim()
              }
            >
              <FileDown className="mr-2 h-4 w-4" />
              {isExporting ? 'Exporting...' : 'Export Report'}
            </Button>
          </aside>

          <main className="space-y-6">
            <Card>
              <div className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-(--text)">Live Preview</h2>
                    <p className="text-sm text-(--muted)">
                      Preview rows refresh automatically when the date range changes.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-(--muted)">
                      {totalRows} matching rows
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-(--muted)">
                      {previewRows.length} preview rows
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void previewQuery.refetch()}
                      disabled={!organizationPublicKey.trim() || previewQuery.isFetching}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh
                    </Button>
                  </div>
                </div>

                {!organizationPublicKey.trim() ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-6 py-16 text-center">
                    <p className="text-lg font-semibold text-(--text)">Add an organization key</p>
                    <p className="mt-2 text-sm text-(--muted)">
                      Paste an organization public key to load payroll data and enable exports.
                    </p>
                  </div>
                ) : previewQuery.isError ? (
                  <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-6 py-16 text-center">
                    <p className="text-lg font-semibold text-rose-100">Unable to load preview</p>
                    <p className="mt-2 text-sm text-rose-100/80">
                      {previewQuery.error instanceof Error
                        ? previewQuery.error.message
                        : 'The payroll query returned an unexpected error.'}
                    </p>
                  </div>
                ) : isPreviewing ? (
                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                    <span className="sr-only" role="status" aria-live="polite">
                      Loading payroll preview…
                    </span>
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-separate border-spacing-0">
                        <thead className="sticky top-0 bg-[#111827]">
                          <tr>
                            {(selectedColumnMeta.length > 0
                              ? selectedColumnMeta
                              : DEFAULT_SELECTED_COLUMNS.map((id) => ({ id, label: id }))
                            ).map((column) => (
                              <th
                                key={column.id}
                                className="border-b border-white/10 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.22em] text-(--muted)"
                              >
                                {column.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody aria-busy="true">
                          <SkeletonLoader
                            variant="table-row"
                            count={6}
                            columns={Math.max(
                              selectedColumnMeta.length,
                              DEFAULT_SELECTED_COLUMNS.length
                            )}
                          />
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : selectedColumnMeta.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-6 py-16 text-center">
                    <p className="text-lg font-semibold text-(--text)">No columns selected</p>
                    <p className="mt-2 text-sm text-(--muted)">
                      Choose at least one column to render the preview table.
                    </p>
                  </div>
                ) : previewRows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-6 py-16 text-center">
                    <p className="text-lg font-semibold text-(--text)">No payroll rows found</p>
                    <p className="mt-2 text-sm text-(--muted)">
                      Try widening the date range to surface more transactions.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-separate border-spacing-0">
                        <thead className="sticky top-0 bg-[#111827]">
                          <tr>
                            {selectedColumnMeta.map((column) => (
                              <th
                                key={column.id}
                                className="border-b border-white/10 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.22em] text-(--muted)"
                              >
                                {column.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewRows.map((row, index) => (
                            <tr
                              key={row.txHash}
                              className={index % 2 === 0 ? 'bg-white/[0.02]' : 'bg-transparent'}
                            >
                              {selectedColumnMeta.map((column) => {
                                const value = formatCell(row, column.id);
                                const isHash = column.id === 'txHash';
                                const isStatus = column.id === 'status';
                                const isTimestamp = column.id === 'timestamp';

                                return (
                                  <td
                                    key={column.id}
                                    className="border-b border-white/5 px-4 py-4 align-top text-sm text-(--text)"
                                  >
                                    {isStatus ? (
                                      <span
                                        className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${formatStatusTone(row.successful)}`}
                                      >
                                        {value}
                                      </span>
                                    ) : isHash && row.txHash ? (
                                      <a
                                        href={getTxExplorerUrl(row.txHash)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title={row.txHash}
                                        className="inline-flex items-center gap-1 font-mono text-[12px] text-(--accent) hover:underline"
                                      >
                                        {value}
                                        <ExternalLink className="w-3 h-3 shrink-0" />
                                      </a>
                                    ) : (
                                      <span
                                        className={`block ${isTimestamp ? 'font-mono text-[12px]' : ''} ${column.id === 'amount' ? 'font-semibold text-(--accent)' : ''}`}
                                      >
                                        {value}
                                      </span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </main>
        </div>
      </div>
    </div>
  );
}
