import React, { useState, useRef, useCallback, useId, useMemo, useEffect } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNotification } from '../hooks/useNotification';
import { MAX_FILE_SIZE, READ_PHASE_WEIGHT, parseCSV, buildErrorReportCsv, type CSVRow, type CSVRowFilter, type CSVTranslate } from '../utils/csvParser';
import { generateCSVTemplate, downloadCSV, createAutoMapping, mapRowData } from '../utils/csvTemplateGenerator';
import { UploadZone, ErrorAlert, FileSummary } from './CSVUploaderParts';
import { RowErrorsTable, PreviewTable } from './CSVUploaderPreview';
import { ColumnMappingPanel } from './CSVUploaderMapping';

export type { CSVRow, CSVFieldError } from '../utils/csvParser';

type UploadPhase = 'reading' | 'validating' | 'mapping';

interface CSVUploaderProps {
  requiredColumns: string[];
  onDataParsed: (data: CSVRow[]) => void;
  validators?: Record<string, (value: string) => string | null>;
  strictHeaderValidation?: boolean;
  enableColumnMapping?: boolean;
  enableTemplateDownload?: boolean;
}

/** Build the success notification body, or `null` when there are no valid rows. */
function buildSuccessSummary(valid: number, invalid: number, translate: CSVTranslate): string | null {
  if (valid <= 0) return null;
  return invalid > 0
    ? `${translate('csvUploader.validRowsPlural', { count: valid })}, ${translate('csvUploader.withErrorsPlural', { count: invalid })}`
    : translate('csvUploader.rowsReadyPlural', { count: valid });
}

export const CSVUploader: React.FC<CSVUploaderProps> = ({
  requiredColumns, onDataParsed, validators = {}, strictHeaderValidation = true,
  enableColumnMapping = false, enableTemplateDownload = true,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [parsedData, setParsedData] = useState<CSVRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number>(0);
  const [parseError, setParseError] = useState<string | null>(null);
  const [phase, setPhase] = useState<UploadPhase>('reading');
  const [parseProgress, setParseProgress] = useState<number>(0);
  const [rowFilter, setRowFilter] = useState<CSVRowFilter>('all');
  const [uploadedHeaders, setUploadedHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [showMappingUI, setShowMappingUI] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadZoneRef = useRef<HTMLDivElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const dragDepth = useRef(0);
  const { t } = useTranslation();
  // i18next's `t` has generic overloads; narrow it to the pure module's translator shape.
  const translate: CSVTranslate = useCallback((key, vars) => (t as unknown as CSVTranslate)(key, vars), [t]);
  const { notifySuccess, notifyError } = useNotification();
  const errorId = useId();
  const descriptionId = useId();
  const progressLabelId = useId();
  const rowErrorsHeadingId = useId();
  const previewHeadingId = useId();
  const prefersReducedMotion = useReducedMotion() ?? false;
  const transitionDuration = prefersReducedMotion ? 0 : 0.2;

  useEffect(() => {
    if (enableColumnMapping && typeof Worker !== 'undefined') {
      const worker = new Worker(new URL('../workers/csvParser.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      return () => worker.terminate();
    }
  }, [enableColumnMapping]);

  const handleFileParse = useCallback((file: File) => {
    setParseError(null);
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setParseError(translate('csvUploader.errorInvalidFormat'));
      notifyError(translate('csvUploader.notifyInvalidFormatTitle'), translate('csvUploader.notifyInvalidFormatBody'));
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      const maxSizeMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(1);
      setParseError(translate('csvUploader.errorFileTooLarge', { maxSizeMB }));
      notifyError(translate('csvUploader.notifyFileTooLargeTitle'), translate('csvUploader.notifyFileTooLargeBody', { maxSizeMB }));
      return;
    }

    setFileName(file.name); setFileSize(file.size); setParsedData([]); setRowFilter('all');
    setUploadedHeaders([]); setShowMappingUI(false); setIsLoading(true);
    setPhase('reading'); setParseProgress(0);
    const reader = new FileReader();

    reader.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) setParseProgress(Math.round((e.loaded / e.total) * READ_PHASE_WEIGHT));
    };
    reader.onload = async (e) => {
      try {
        setPhase('validating');
        setParseProgress(READ_PHASE_WEIGHT);
        const result = await parseCSV(e.target?.result as string, {
          requiredColumns, validators, strictHeaderValidation, translate,
          onProgress: (processed, total) => {
            const validated = total > 0 ? processed / total : 1;
            setParseProgress(Math.round(READ_PHASE_WEIGHT + validated * (100 - READ_PHASE_WEIGHT)));
          },
        });
        if (!result.ok) {
          setParseError(result.error);
          setIsLoading(false);
          return;
        }

        const rows = result.rows;
        setParsedData(rows);
        if (enableColumnMapping && rows.length > 0) {
          const headers = Object.keys(rows[0].data);
          setUploadedHeaders(headers);
          setColumnMapping(createAutoMapping(headers, requiredColumns));
          setShowMappingUI(true);
          setIsLoading(false);
          return;
        }

        onDataParsed(rows);
        setIsLoading(false);
        const summary = buildSuccessSummary(
          rows.filter((r) => r.isValid).length, rows.filter((r) => !r.isValid).length, translate
        );
        if (summary) notifySuccess(translate('csvUploader.notifyParsedSuccessTitle'), summary);
      } catch (error) {
        setParseError(translate('csvUploader.errorParsing'));
        console.error('CSV parsing error:', error);
        setIsLoading(false);
      }
    };
    reader.onerror = () => { setParseError(translate('csvUploader.errorReading')); setIsLoading(false); };
    reader.readAsText(file);
  }, [requiredColumns, validators, strictHeaderValidation, translate, notifySuccess, notifyError, enableColumnMapping, onDataParsed]);

  const openFilePicker = useCallback(() => { if (!isLoading) fileInputRef.current?.click(); }, [isLoading]);
  const handleZoneClick = (e: React.MouseEvent) => {
    if (e.target === fileInputRef.current) return;
    openFilePicker();
  };
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragDepth.current += 1;
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragDepth.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && !isLoading) handleFileParse(file);
  };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileParse(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  const handleZoneKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFilePicker(); }
  };
  const handleRemoveFile = () => {
    setParsedData([]); setFileName(null); setFileSize(0); setParseError(null); setRowFilter('all');
    onDataParsed([]);
    uploadZoneRef.current?.focus();
  };

  const generateErrorReport = useCallback(() => {
    const csvContent = buildErrorReportCsv(parsedData, translate);
    if (csvContent === null) return;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `error-report-${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [parsedData, translate]);

  const handleDownloadTemplate = useCallback(() => {
    const template = generateCSVTemplate({
      columns: requiredColumns,
      sampleData: [requiredColumns.reduce((row, col) => ({ ...row, [col]: '' }), {})],
    });
    const timestamp = new Date().toISOString().split('T')[0];
    downloadCSV(template, `import-template-${timestamp}.csv`);
    notifySuccess(
      translate('csvUploader.templateDownloaded', 'Template downloaded'),
      translate('csvUploader.templateDownloadedBody', 'CSV template ready for import')
    );
  }, [requiredColumns, notifySuccess, translate]);

  const handleMappingComplete = useCallback(() => {
    if (!showMappingUI || uploadedHeaders.length === 0) return;
    setShowMappingUI(false);
    setPhase('validating');
    setParseProgress(READ_PHASE_WEIGHT);
    const mappedData = parsedData.map((row) => ({ ...row, data: mapRowData(row.data, columnMapping) }));
    setParsedData(mappedData);
    onDataParsed(mappedData);
    const summary = buildSuccessSummary(
      mappedData.filter((r) => r.isValid).length, mappedData.filter((r) => !r.isValid).length, translate
    );
    if (summary) notifySuccess(translate('csvUploader.notifyParsedSuccessTitle'), summary);
  }, [showMappingUI, uploadedHeaders, columnMapping, parsedData, onDataParsed, translate, notifySuccess]);

  const validRowsCount = parsedData.filter((r) => r.isValid).length;
  const invalidRowsCount = parsedData.length - validRowsCount;
  const hasData = parsedData.length > 0;
  const previewColumns = Object.keys(parsedData[0]?.data || {});
  const maxSizeMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
  const visibleRows = useMemo(() => {
    if (rowFilter === 'valid') return parsedData.filter((r) => r.isValid);
    if (rowFilter === 'invalid') return parsedData.filter((r) => !r.isValid);
    return parsedData;
  }, [parsedData, rowFilter]);
  const phaseLabel = phase === 'reading' ? translate('csvUploader.phaseReading') : translate('csvUploader.phaseValidating');
  const filterOptions: Array<{ value: CSVRowFilter; label: string }> = [
    { value: 'all', label: translate('csvUploader.filterAll', { count: parsedData.length }) },
    { value: 'valid', label: translate('csvUploader.filterValid', { count: validRowsCount }) },
    { value: 'invalid', label: translate('csvUploader.filterInvalid', { count: invalidRowsCount }) },
  ];

  return (
    <div className="w-full min-w-0" role="region" aria-label={translate('csvUploader.regionAriaLabel')}>
      <UploadZone
        uploadZoneRef={uploadZoneRef} fileInputRef={fileInputRef} descriptionId={descriptionId}
        requiredColumns={requiredColumns} hasData={hasData} isDragging={isDragging}
        isLoading={isLoading} enableTemplateDownload={enableTemplateDownload}
        prefersReducedMotion={prefersReducedMotion} transitionDuration={transitionDuration}
        maxSizeMB={maxSizeMB} t={translate} onZoneClick={handleZoneClick}
        onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver}
        onDrop={handleDrop} onKeyDown={handleZoneKeyDown} onFileSelect={handleFileSelect}
        onDownloadTemplate={(e) => { e.stopPropagation(); handleDownloadTemplate(); }}
      />
      <ErrorAlert
        show={Boolean(parseError)} errorId={errorId} parseError={parseError}
        prefersReducedMotion={prefersReducedMotion} transitionDuration={transitionDuration} t={translate}
      />
      <FileSummary
        show={Boolean(fileName && !parseError)} fileName={fileName} fileSize={fileSize}
        isLoading={isLoading} invalidRowsCount={invalidRowsCount} hasData={hasData}
        parsedDataLength={parsedData.length} validRowsCount={validRowsCount}
        parseProgress={parseProgress} phaseLabel={phaseLabel} phase={phase}
        progressLabelId={progressLabelId} prefersReducedMotion={prefersReducedMotion}
        transitionDuration={transitionDuration} t={translate}
        onGenerateErrorReport={generateErrorReport} onOpenFilePicker={openFilePicker}
        onRemoveFile={handleRemoveFile}
      />
      <ColumnMappingPanel
        show={showMappingUI} uploadedHeaders={uploadedHeaders} columnMapping={columnMapping}
        requiredColumns={requiredColumns} prefersReducedMotion={prefersReducedMotion}
        transitionDuration={transitionDuration} t={translate}
        onMappingChange={(header, value) => setColumnMapping((prev) => ({ ...prev, [header]: value }))}
        onCancel={() => { setShowMappingUI(false); handleRemoveFile(); }}
        onComplete={handleMappingComplete}
      />
      <RowErrorsTable
        show={invalidRowsCount > 0} parsedData={parsedData} invalidRowsCount={invalidRowsCount}
        rowErrorsHeadingId={rowErrorsHeadingId} prefersReducedMotion={prefersReducedMotion}
        transitionDuration={transitionDuration} t={translate}
      />
      <PreviewTable
        show={hasData} visibleRows={visibleRows} previewColumns={previewColumns}
        rowFilter={rowFilter} filterOptions={filterOptions} previewHeadingId={previewHeadingId}
        prefersReducedMotion={prefersReducedMotion} transitionDuration={transitionDuration}
        t={translate} onRowFilterChange={setRowFilter}
      />
    </div>
  );
};
