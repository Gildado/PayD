import Server from '@stellar/stellar-sdk';
import { sdsClient, SDSTransaction } from '../services/sds.service';
import { payrollQueryService } from '../services/payroll-query.service';
import { parsePaginationParams } from '../utils/pagination';
import logger from '../utils/logger';

interface BenchmarkResult {
  operation: string;
  method: 'Horizon' | 'SDS';
  recordCount: number;
  duration: number;
  memoryBefore: number;
  memoryAfter: number;
  memoryDelta: number;
  throughput: number; // records per second
  success: boolean;
  error?: string;
}

class SDSvHorizonBenchmark {
  private horizonServer: any;
  private results: BenchmarkResult[] = [];
  private testOrganizationKey = 'GBVNRQSKKYQJLQR6W3EI7A5PKQXRG7FRYOJJIMTSLRVPXHPNNJZXUAEM';

  constructor() {
    this.horizonServer = new Server('https://horizon-testnet.stellar.org');
  }

  /**
   * Benchmark: Query large transaction set (10k+ records)
   */
  async benchmarkLargeTransactionSet(): Promise<void> {
    logger.info('Starting benchmark: Large Transaction Set');

    // Horizon benchmarking
    const horizonResult = await this.benchmarkHorizonLargeQuery();
    this.results.push(horizonResult);

    // SDS benchmarking
    const sdsResult = await this.benchmarkSDSLargeQuery();
    this.results.push(sdsResult);
  }

  /**
   * Benchmark: Organization-wide historical audit
   */
  async benchmarkOrganizationAudit(): Promise<void> {
    logger.info('Starting benchmark: Organization-wide Historical Audit');

    // Horizon benchmarking
    const horizonResult = await this.benchmarkHorizonAudit();
    this.results.push(horizonResult);

    // SDS benchmarking
    const sdsResult = await this.benchmarkSDSAudit();
    this.results.push(sdsResult);
  }

  /**
   * Benchmark: Complex filtering (memo + asset + account)
   */
  async benchmarkComplexFiltering(): Promise<void> {
    logger.info('Starting benchmark: Complex Filtering');

    // SDS benchmarking
    const sdsResult = await this.benchmarkSDSComplexFilter();
    this.results.push(sdsResult);
  }

  /**
   * Benchmark: Aggregation operations
   */
  async benchmarkAggregation(): Promise<void> {
    logger.info('Starting benchmark: Aggregation Operations');

    // SDS benchmarking
    const sdsResult = await this.benchmarkSDSAggregation();
    this.results.push(sdsResult);
  }

  // Horizon benchmark implementations

  private async benchmarkHorizonLargeQuery(): Promise<BenchmarkResult> {
    const operation = 'Large Transaction Set (10k+ records)';
    const memBefore = process.memoryUsage().heapUsed;
    const startTime = performance.now();

    try {
      const allTransactions: any[] = [];
      let cursor = '';
      let pageCount = 0;
      const maxPages = 5; // Limit to prevent excessive API calls

      while (pageCount < maxPages) {
        try {
          const response = (await this.horizonServer
            .transactions()
            .forAccount(this.testOrganizationKey)
            .limit(200)
            .cursor(cursor)
            .call()) as any;

          if (!response.records || response.records.length === 0) {
            break;
          }

          allTransactions.push(...response.records);
          cursor = response.records[response.records.length - 1].paging_token;
          pageCount++;

          if (allTransactions.length > 10000) {
            break;
          }
        } catch (error) {
          logger.warn(`Horizon pagination stopped at page ${pageCount}`);
          break;
        }
      }

      const duration = performance.now() - startTime;
      const memAfter = process.memoryUsage().heapUsed;
      const memDelta = memAfter - memBefore;

      return {
        operation,
        method: 'Horizon',
        recordCount: allTransactions.length,
        duration,
        memoryBefore: memBefore,
        memoryAfter: memAfter,
        memoryDelta: memDelta,
        throughput: allTransactions.length / (duration / 1000),
        success: true,
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      const memAfter = process.memoryUsage().heapUsed;

      return {
        operation,
        method: 'Horizon',
        recordCount: 0,
        duration,
        memoryBefore: memBefore,
        memoryAfter: memAfter,
        memoryDelta: memAfter - memBefore,
        throughput: 0,
        success: false,
        error: (error as Error).message,
      };
    }
  }

  private async benchmarkHorizonAudit(): Promise<BenchmarkResult> {
    const operation = 'Organization-wide Historical Audit';
    const memBefore = process.memoryUsage().heapUsed;
    const startTime = performance.now();

    try {
      let totalCount = 0;
      let cursor = '';
      let pageCount = 0;
      const maxPages = 3;

      while (pageCount < maxPages) {
        try {
          const response = (await (this.horizonServer as any)
            .transactions()
            .forAccount(this.testOrganizationKey)
            .limit(200)
            .cursor(cursor)
            .call()) as any;

          if (!response.records || response.records.length === 0) {
            break;
          }

          totalCount += response.records.length;
          cursor = response.records[response.records.length - 1].paging_token;
          pageCount++;
        } catch (error) {
          break;
        }
      }

      const duration = performance.now() - startTime;
      const memAfter = process.memoryUsage().heapUsed;

      return {
        operation,
        method: 'Horizon',
        recordCount: totalCount,
        duration,
        memoryBefore: memBefore,
        memoryAfter: memAfter,
        memoryDelta: memAfter - memBefore,
        throughput: totalCount / (duration / 1000),
        success: true,
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      const memAfter = process.memoryUsage().heapUsed;

      return {
        operation,
        method: 'Horizon',
        recordCount: 0,
        duration,
        memoryBefore: memBefore,
        memoryAfter: memAfter,
        memoryDelta: memAfter - memBefore,
        throughput: 0,
        success: false,
        error: (error as Error).message,
      };
    }
  }

  // SDS benchmark implementations

  private async benchmarkSDSLargeQuery(): Promise<BenchmarkResult> {
    const operation = 'Large Transaction Set (10k+ records)';
    const memBefore = process.memoryUsage().heapUsed;
    const startTime = performance.now();

    try {
      const allTransactions: SDSTransaction[] = [];
      let page = 1;

      // Mock SDS responses - in real scenario, would query actual SDS
      while (page <= 5) {
        const pagination = parsePaginationParams(page, 2000);
        try {
          const { transactions } = await sdsClient.queryTransactions(
            { sourceAccount: this.testOrganizationKey },
            pagination
          );

          if (!transactions || transactions.length === 0) {
            break;
          }

          allTransactions.push(...transactions);

          if (allTransactions.length > 10000) {
            break;
          }

          page++;
        } catch (error) {
          logger.warn(`SDS pagination stopped at page ${page}`);
          break;
        }
      }

      const duration = performance.now() - startTime;
      const memAfter = process.memoryUsage().heapUsed;

      return {
        operation,
        method: 'SDS',
        recordCount: allTransactions.length,
        duration,
        memoryBefore: memBefore,
        memoryAfter: memAfter,
        memoryDelta: memAfter - memBefore,
        throughput: allTransactions.length / (duration / 1000),
        success: true,
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      const memAfter = process.memoryUsage().heapUsed;

      return {
        operation,
        method: 'SDS',
        recordCount: 0,
        duration,
        memoryBefore: memBefore,
        memoryAfter: memAfter,
        memoryDelta: memAfter - memBefore,
        throughput: 0,
        success: false,
        error: (error as Error).message,
      };
    }
  }

  private async benchmarkSDSAudit(): Promise<BenchmarkResult> {
    const operation = 'Organization-wide Historical Audit';
    const memBefore = process.memoryUsage().heapUsed;
    const startTime = performance.now();

    try {
      const result = await payrollQueryService.getOrganizationAuditReport(this.testOrganizationKey);

      const duration = performance.now() - startTime;
      const memAfter = process.memoryUsage().heapUsed;

      return {
        operation,
        method: 'SDS',
        recordCount: result.aggregation.totalCount,
        duration,
        memoryBefore: memBefore,
        memoryAfter: memAfter,
        memoryDelta: memAfter - memBefore,
        throughput: result.aggregation.totalCount / (duration / 1000),
        success: true,
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      const memAfter = process.memoryUsage().heapUsed;

      return {
        operation,
        method: 'SDS',
        recordCount: 0,
        duration,
        memoryBefore: memBefore,
        memoryAfter: memAfter,
        memoryDelta: memAfter - memBefore,
        throughput: 0,
        success: false,
        error: (error as Error).message,
      };
    }
  }

  private async benchmarkSDSComplexFilter(): Promise<BenchmarkResult> {
    const operation = 'Complex Filtering (memo + asset + account)';
    const memBefore = process.memoryUsage().heapUsed;
    const startTime = performance.now();

    try {
      const pagination = parsePaginationParams(1, 5000);
      const { transactions } = await sdsClient.queryTransactions(
        {
          sourceAccount: this.testOrganizationKey,
          memoPattern: 'PAYROLL:*',
          assetCode: 'USDC',
          startTime: Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000), // 30 days ago
        },
        pagination
      );

      const duration = performance.now() - startTime;
      const memAfter = process.memoryUsage().heapUsed;

      return {
        operation,
        method: 'SDS',
        recordCount: transactions.length,
        duration,
        memoryBefore: memBefore,
        memoryAfter: memAfter,
        memoryDelta: memAfter - memBefore,
        throughput: transactions.length / (duration / 1000),
        success: true,
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      const memAfter = process.memoryUsage().heapUsed;

      return {
        operation,
        method: 'SDS',
        recordCount: 0,
        duration,
        memoryBefore: memBefore,
        memoryAfter: memAfter,
        memoryDelta: memAfter - memBefore,
        throughput: 0,
        success: false,
        error: (error as Error).message,
      };
    }
  }

  private async benchmarkSDSAggregation(): Promise<BenchmarkResult> {
    const operation = 'Aggregation Operations';
    const memBefore = process.memoryUsage().heapUsed;
    const startTime = performance.now();

    try {
      const aggregation = await sdsClient.aggregateTransactions({
        sourceAccount: this.testOrganizationKey,
        assetCode: 'USDC',
      });

      const duration = performance.now() - startTime;
      const memAfter = process.memoryUsage().heapUsed;

      return {
        operation,
        method: 'SDS',
        recordCount: aggregation.totalCount,
        duration,
        memoryBefore: memBefore,
        memoryAfter: memAfter,
        memoryDelta: memAfter - memBefore,
        throughput: aggregation.totalCount / (duration / 1000),
        success: true,
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      const memAfter = process.memoryUsage().heapUsed;

      return {
        operation,
        method: 'SDS',
        recordCount: 0,
        duration,
        memoryBefore: memBefore,
        memoryAfter: memAfter,
        memoryDelta: memAfter - memBefore,
        throughput: 0,
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Run all benchmarks
   */
  async runAllBenchmarks(): Promise<void> {
    logger.info('=== Starting SDS vs Horizon Benchmark Suite ===');

    try {
      await this.benchmarkLargeTransactionSet();
      await this.benchmarkOrganizationAudit();
      await this.benchmarkComplexFiltering();
      await this.benchmarkAggregation();

      this.printResults();
      this.saveResults();
    } catch (error) {
      logger.error('Benchmark suite failed', error);
    }
  }

  /**
   * Print results in human-readable format
   */
  private printResults(): void {
    console.log('\n=== Benchmark Results ===\n');

    // Group by operation
    const groupedByOperation = new Map<string, BenchmarkResult[]>();
    this.results.forEach((r) => {
      if (!groupedByOperation.has(r.operation)) {
        groupedByOperation.set(r.operation, []);
      }
      groupedByOperation.get(r.operation)!.push(r);
    });

    // Print comparison for each operation
    groupedByOperation.forEach((results, operation) => {
      console.log(`\n📊 Operation: ${operation}`);
      console.log('─'.repeat(100));

      results.forEach((result) => {
        const status = result.success ? '✅' : '❌';
        const memMB = (result.memoryDelta / 1024 / 1024).toFixed(2);
        const throughput = result.throughput.toFixed(2);

        console.log(`${status} Method: ${result.method}`);
        console.log(`   Records: ${result.recordCount.toString().padStart(10)}`);
        console.log(`   Duration: ${result.duration.toFixed(2).padStart(10)} ms`);
        console.log(`   Memory Delta: ${memMB.padStart(10)} MB`);
        console.log(`   Throughput: ${throughput.padStart(10)} records/sec`);

        if (!result.success && result.error) {
          console.log(`   Error: ${result.error}`);
        }
      });

      // Calculate improvement
      if (results.length === 2) {
        const [horizon, sds] = results.sort((a, b) => (a.method === 'Horizon' ? -1 : 1));

        if (horizon.success && sds.success) {
          const speedup = (((horizon.duration - sds.duration) / horizon.duration) * 100).toFixed(2);
          const memoryImprovement = (
            ((horizon.memoryDelta - sds.memoryDelta) / horizon.memoryDelta) *
            100
          ).toFixed(2);

          console.log(`\n📈 Improvement (SDS vs Horizon):`);
          console.log(
            `   Speed: ${speedup}% faster (${horizon.duration.toFixed(2)}ms → ${sds.duration.toFixed(2)}ms)`
          );
          console.log(`   Memory: ${memoryImprovement}% better`);
        }
      }
    });

    console.log('\n' + '='.repeat(100) + '\n');
  }

  /**
   * Save results to file
   */
  private saveResults(): void {
    const timestamp = new Date().toISOString();
    const reportPath = `./benchmark-results-${timestamp.replace(/[:.]/g, '-')}.json`;

    const report = {
      timestamp,
      results: this.results,
      summary: this.generateSummary(),
    };

    const fs = require('fs');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    logger.info(`Benchmark results saved to: ${reportPath}`);
  }

  /**
   * Generate summary statistics
   */
  private generateSummary(): any {
    const sdsResults = this.results.filter((r) => r.method === 'SDS' && r.success);
    const horizonResults = this.results.filter((r) => r.method === 'Horizon' && r.success);

    return {
      totalOperations: this.results.length,
      successfulOperations: this.results.filter((r) => r.success).length,
      failedOperations: this.results.filter((r) => !r.success).length,
      avgSDSDuration:
        sdsResults.length > 0
          ? sdsResults.reduce((sum, r) => sum + r.duration, 0) / sdsResults.length
          : 0,
      avgHorizonDuration:
        horizonResults.length > 0
          ? horizonResults.reduce((sum, r) => sum + r.duration, 0) / horizonResults.length
          : 0,
      totalSDSRecords: sdsResults.reduce((sum, r) => sum + r.recordCount, 0),
      totalHorizonRecords: horizonResults.reduce((sum, r) => sum + r.recordCount, 0),
    };
  }
}

// Run benchmarks if executed directly
if (require.main === module) {
  const benchmark = new SDSvHorizonBenchmark();
  benchmark.runAllBenchmarks().catch((error) => {
    logger.error('Fatal benchmark error', error);
    process.exit(1);
  });
}

export default SDSvHorizonBenchmark;
