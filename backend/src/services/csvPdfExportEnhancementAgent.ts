/**
 * CSV/PDF Export Enhancement Agent (#1301)
 *
 * Analyzes export patterns to surface enhancement opportunities:
 * - Which columns are most/least used
 * - Format distribution (csv/excel/pdf)
 * - Average row counts and file sizes per format
 * - Recommendations for default column sets
 *
 * Output schema:
 *   - summary: totalExports, formatDistribution, avgRowCount, avgFileSize
 *   - columnUsage: per-column usage frequency
 *   - enhancementRecommendations: suggested improvements
 */

import {
  type IReportAgent,
  type ReportResult,
  type SafetyValidation,
  ReportFormat,
} from './reportSchema.js';

export interface ExportEnhancementFilters {
  organizationPublicKey?: string;
  startDate?: string;
  endDate?: string;
}

export interface ColumnUsage {
  column: string;
  usageCount: number;
  usageRate: number;
}

export interface FormatStats {
  format: string;
  count: number;
  avgRowCount: number;
  avgFileSize: number;
  successRate: number;
}

export interface EnhancementRecommendation {
  type: 'COLUMN_DEFAULT' | 'FORMAT_SUGGESTION' | 'PERFORMANCE';
  message: string;
  priority: 'high' | 'medium' | 'low';
}

export interface CsvPdfExportEnhancementReport {
  summary: {
    totalExports: number;
    successfulExports: number;
    failedExports: number;
    formatDistribution: Record<string, number>;
    avgRowCount: number;
    avgFileSize: number;
  };
  columnUsage: ColumnUsage[];
  formatBreakdown: FormatStats[];
  recommendations: EnhancementRecommendation[];
}

export class CsvPdfExportEnhancementAgent implements IReportAgent {
  id = 'csv-pdf-export-enhancement';
  name = 'CSV/PDF Export Enhancement Report';
  description = 'Analyzes export patterns to surface enhancement opportunities';

  async execute(filters?: Record<string, any>): Promise<ReportResult> {
    const f = filters as ExportEnhancementFilters | undefined;

    // In production, this would query the export_history table or
    // aggregate from the exportJobService logs. The agent defines the
    // output schema and aggregation logic.
    const exports = await this.fetchExportHistory(f);

    const successfulExports = exports.filter((e) => e.status === 'success');
    const failedExports = exports.filter((e) => e.status === 'failed');

    // Format distribution
    const formatDistribution: Record<string, number> = {};
    for (const e of exports) {
      formatDistribution[e.format] = (formatDistribution[e.format] || 0) + 1;
    }

    // Column usage analysis
    const columnCounts = new Map<string, number>();
    for (const e of exports) {
      for (const col of e.columns) {
        columnCounts.set(col, (columnCounts.get(col) || 0) + 1);
      }
    }
    const columnUsage: ColumnUsage[] = [...columnCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([column, usageCount]) => ({
        column,
        usageCount,
        usageRate: Math.round((usageCount / exports.length) * 10000) / 100,
      }));

    // Per-format stats
    const formats = [...new Set(exports.map((e) => e.format))];
    const formatBreakdown: FormatStats[] = formats.map((format) => {
      const subset = exports.filter((e) => e.format === format);
      const successes = subset.filter((e) => e.status === 'success');
      return {
        format,
        count: subset.length,
        avgRowCount: successes.length
          ? Math.round(successes.reduce((s, e) => s + e.rowCount, 0) / successes.length)
          : 0,
        avgFileSize: successes.length
          ? Math.round(successes.reduce((s, e) => s + e.fileSize, 0) / successes.length)
          : 0,
        successRate: subset.length
          ? Math.round((successes.length / subset.length) * 10000) / 100
          : 0,
      };
    });

    // Average metrics
    const avgRowCount = exports.length
      ? Math.round(exports.reduce((s, e) => s + e.rowCount, 0) / exports.length)
      : 0;
    const avgFileSize = exports.length
      ? Math.round(exports.reduce((s, e) => s + e.fileSize, 0) / exports.length)
      : 0;

    // Generate enhancement recommendations
    const recommendations = this.generateRecommendations(columnUsage, formatBreakdown, exports);

    const report: CsvPdfExportEnhancementReport = {
      summary: {
        totalExports: exports.length,
        successfulExports: successfulExports.length,
        failedExports: failedExports.length,
        formatDistribution,
        avgRowCount,
        avgFileSize,
      },
      columnUsage,
      formatBreakdown,
      recommendations,
    };

    return {
      executionId: crypto.randomUUID(),
      format: ReportFormat.JSON,
      data: [report as unknown as Record<string, any>],
      summary: {
        totalRecords: exports.length,
        processedRecords: exports.length,
        failedRecords: failedExports.length,
        generatedAt: new Date(),
        generatedBy: 0,
      },
      metadata: {
        version: '1.0',
        schema: 'csv-pdf-export-enhancement',
        checksum: '',
      },
    };
  }

  async validate(): Promise<SafetyValidation> {
    return { isValid: true, issues: [], piiDetected: [] };
  }

  private async fetchExportHistory(_filters?: ExportEnhancementFilters): Promise<
    Array<{
      format: string;
      columns: string[];
      rowCount: number;
      fileSize: number;
      status: string;
      timestamp: number;
    }>
  > {
    // In production, query from export_logs or the export history table.
    // The agent defines the schema; data population depends on the
    // export tracking infrastructure.
    return [];
  }

  private generateRecommendations(
    columnUsage: ColumnUsage[],
    _formatBreakdown: FormatStats[],
    _exports: any[]
  ): EnhancementRecommendation[] {
    const recs: EnhancementRecommendation[] = [];

    // Recommend default columns based on high usage
    const highUsage = columnUsage.filter((c) => c.usageRate >= 80);
    if (highUsage.length > 0) {
      recs.push({
        type: 'COLUMN_DEFAULT',
        message: `Consider setting these columns as defaults: ${highUsage.map((c) => c.column).join(', ')}`,
        priority: 'high',
      });
    }

    // Flag rarely-used columns
    const lowUsage = columnUsage.filter((c) => c.usageRate < 20);
    if (lowUsage.length > 0) {
      recs.push({
        type: 'COLUMN_DEFAULT',
        message: `These columns are rarely used and could be hidden by default: ${lowUsage.map((c) => c.column).join(', ')}`,
        priority: 'medium',
      });
    }

    return recs;
  }
}
