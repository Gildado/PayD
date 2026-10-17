/**
 * Csv Import Anomaly and Injection Detection Agent.
 *
 * Detects formula injection (DDE/CSV injection), payload injection (XSS/SQLi),
 * statistical salary outliers, duplicate wallet redistribution attacks,
 * and high-ratio error batches in bulk payroll CSV imports.
 *
 * Resolves Issue #1200.
 */

import { randomUUID } from 'node:crypto';
import type { AnomalyEvent, AnomalyEventHandler } from '../types/anomalyEvent.js';
import type { CsvRow, ImportResult } from './csvPayrollImportService.js';

export interface CsvImportAnomalyOptions {
  /** Maximum normal monthly salary before flagging as statistical outlier. Default: 50,000. */
  maxSalaryThreshold?: number;
  /** Maximum acceptable failure ratio (errors / totalRows). Default: 0.5 (50%). */
  maxBatchErrorRatio?: number;
  /** Enable CSV formula injection checks (=, +, -, @, cmd, etc.). Default: true. */
  enableFormulaInjectionCheck?: boolean;
  /** Enable duplicate wallet address reuse checks across different names. Default: true. */
  enableDuplicateWalletCheck?: boolean;
  /** Optional callback or event handler for downstream alerting. */
  onAnomaly?: AnomalyEventHandler;
}

const FORMULA_INJECTION_PREFIX_REGEX = /^[=+\-@\t\r]/;
const DANGEROUS_FORMULA_PATTERNS = [
  /=cmd/i,
  /=powershell/i,
  /=hyperlink/i,
  /=dde/i,
  /=exec/i,
  /<script/i,
  /javascript:/i,
  /drop\s+table/i,
  /union\s+select/i,
];

export class CsvImportAnomalyDetectionAgent {
  readonly id = 'csv-import-anomaly-detection';
  private readonly maxSalaryThreshold: number;
  private readonly maxBatchErrorRatio: number;
  private readonly enableFormulaInjectionCheck: boolean;
  private readonly enableDuplicateWalletCheck: boolean;
  private readonly onAnomaly?: AnomalyEventHandler;

  constructor(options: CsvImportAnomalyOptions = {}) {
    this.maxSalaryThreshold =
      options.maxSalaryThreshold ??
      (process.env.CSV_ANOMALY_MAX_SALARY
        ? Number(process.env.CSV_ANOMALY_MAX_SALARY)
        : 50_000);

    this.maxBatchErrorRatio =
      options.maxBatchErrorRatio ??
      (process.env.CSV_ANOMALY_MAX_ERROR_RATIO
        ? Number(process.env.CSV_ANOMALY_MAX_ERROR_RATIO)
        : 0.5);

    this.enableFormulaInjectionCheck = options.enableFormulaInjectionCheck ?? true;
    this.enableDuplicateWalletCheck = options.enableDuplicateWalletCheck ?? true;
    this.onAnomaly = options.onAnomaly;
  }

  /**
   * Evaluates CSV import rows and results for malicious injection or statistical anomalies.
   */
  async evaluateImport(params: {
    organizationId: number;
    rows: CsvRow[];
    importResult?: ImportResult;
  }): Promise<AnomalyEvent[]> {
    const { organizationId, rows, importResult } = params;
    const anomalies: AnomalyEvent[] = [];

    if (!rows || rows.length === 0) {
      return anomalies;
    }

    const walletMap = new Map<string, string[]>(); // walletAddress -> [email1, email2]
    const salaries: number[] = [];

    // 1. Inspect each row for injection and field anomalies
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      // Formula / Payload Injection Checks
      if (this.enableFormulaInjectionCheck) {
        for (const [column, rawValue] of Object.entries(row)) {
          if (typeof rawValue === 'string' && rawValue.trim().length > 0) {
            const val = rawValue.trim();

            const hasDangerousPattern = DANGEROUS_FORMULA_PATTERNS.some((pattern) =>
              pattern.test(val)
            );
            const startsWithFormulaChar = FORMULA_INJECTION_PREFIX_REGEX.test(val);

            if (hasDangerousPattern || startsWithFormulaChar) {
              const isCommand = hasDangerousPattern || /^[=+\-@].*\|/i.test(val);
              anomalies.push({
                id: randomUUID(),
                agentId: this.id,
                organizationId,
                severity: isCommand ? 'critical' : 'warning',
                reason: 'formula_injection',
                title: 'CSV Injection / Malicious Formula Detected',
                description: `Row ${rowNum} column "${column}" contains potential injection pattern: ${val.slice(0, 50)}`,
                detectedAt: new Date().toISOString(),
                metadata: {
                  row: rowNum,
                  column,
                  flaggedValue: val,
                  employeeEmail: row.email,
                },
              });
            }
          }
        }
      }

      // Track salary numbers
      if (row.base_salary) {
        const sal = parseFloat(row.base_salary);
        if (!isNaN(sal) && sal > 0) {
          salaries.push(sal);

          // Absolute salary ceiling check
          if (sal > this.maxSalaryThreshold) {
            anomalies.push({
              id: randomUUID(),
              agentId: this.id,
              organizationId,
              severity: 'warning',
              reason: 'salary_anomaly',
              title: 'Abnormally High Salary Detected',
              description: `Row ${rowNum} specifies base salary ${sal} which exceeds threshold ${this.maxSalaryThreshold}`,
              detectedAt: new Date().toISOString(),
              metadata: {
                row: rowNum,
                salary: sal,
                threshold: this.maxSalaryThreshold,
                employeeEmail: row.email,
              },
            });
          }
        }
      }

      // Track wallet addresses for duplicate reuse
      if (this.enableDuplicateWalletCheck && row.wallet_address && row.email) {
        const wallet = row.wallet_address.trim();
        const existing = walletMap.get(wallet) || [];
        existing.push(row.email.trim());
        walletMap.set(wallet, existing);
      }
    }

    // 2. Statistical Salary Outlier Evaluation (Z-Score / Mean ratio)
    if (salaries.length >= 5) {
      const sum = salaries.reduce((a, b) => a + b, 0);
      const mean = sum / salaries.length;
      for (const sal of salaries) {
        if (sal > mean * 5 && sal <= this.maxSalaryThreshold) {
          anomalies.push({
            id: randomUUID(),
            agentId: this.id,
            organizationId,
            severity: 'warning',
            reason: 'salary_anomaly',
            title: 'Statistical Salary Outlier Detected',
            description: `Salary ${sal} is more than 5x the batch average (${Math.round(mean)})`,
            detectedAt: new Date().toISOString(),
            metadata: {
              salary: sal,
              batchMean: Math.round(mean),
              ratio: Math.round((sal / mean) * 10) / 10,
            },
          });
        }
      }
    }

    // 3. Duplicate Wallet Address Abuse Check
    if (this.enableDuplicateWalletCheck) {
      for (const [wallet, emails] of walletMap.entries()) {
        const uniqueEmails = Array.from(new Set(emails));
        if (uniqueEmails.length > 1) {
          anomalies.push({
            id: randomUUID(),
            agentId: this.id,
            organizationId,
            severity: 'warning',
            reason: 'duplicate_wallet_reuse',
            title: 'Duplicate Stellar Wallet Address Across Multiple Employees',
            description: `Wallet address "${wallet.slice(0, 8)}...${wallet.slice(-6)}" is mapped to ${uniqueEmails.length} different employees (${uniqueEmails.join(', ')})`,
            detectedAt: new Date().toISOString(),
            metadata: {
              walletAddress: wallet,
              employeeEmails: uniqueEmails,
            },
          });
        }
      }
    }

    // 4. Batch Quality & High Error Rate Check
    if (importResult && importResult.totalRows > 0) {
      const errorRatio = importResult.errorCount / importResult.totalRows;
      if (errorRatio > this.maxBatchErrorRatio && importResult.totalRows >= 5) {
        anomalies.push({
          id: randomUUID(),
          agentId: this.id,
          organizationId,
          severity: 'warning',
          reason: 'high_batch_error_rate',
          title: 'Abnormally High CSV Import Failure Rate',
          description: `Batch had ${importResult.errorCount} errors out of ${importResult.totalRows} rows (${Math.round(errorRatio * 100)}% failure rate, threshold: ${Math.round(this.maxBatchErrorRatio * 100)}%)`,
          detectedAt: new Date().toISOString(),
          metadata: {
            totalRows: importResult.totalRows,
            errorCount: importResult.errorCount,
            errorRatio,
            threshold: this.maxBatchErrorRatio,
          },
        });
      }
    }

    // Notify handler if registered
    if (this.onAnomaly && anomalies.length > 0) {
      for (const anomaly of anomalies) {
        try {
          await this.onAnomaly(anomaly);
        } catch {
          // ignore delivery failures to avoid breaking caller
        }
      }
    }

    return anomalies;
  }
}

export const csvImportAnomalyDetectionAgent = new CsvImportAnomalyDetectionAgent();
