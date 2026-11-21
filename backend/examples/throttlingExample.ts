/**
 * Example: Using Transaction Throttling
 *
 * This file demonstrates various ways to use the transaction throttling mechanism
 * in different scenarios.
 */

import { Keypair, Asset } from '@stellar/stellar-sdk';
import { StellarThrottlingService } from '../services/stellarThrottlingService.js';
import { StellarService } from '../services/stellarService.js';
import { StellarServiceWithThrottling } from '../services/stellarServiceWithThrottling.js';
import logger from '../utils/logger.js';

// Example 1: Basic Transaction Submission
async function example1_basicSubmission() {
  console.log('\n=== Example 1: Basic Transaction Submission ===\n');

  const sourceKeypair = Keypair.random();
  const destinationPublicKey = Keypair.random().publicKey();

  try {
    // Create and sign transaction
    const transaction = await StellarServiceWithThrottling.createPaymentTransaction(
      sourceKeypair,
      destinationPublicKey,
      '100'
    );

    StellarServiceWithThrottling.signTransaction(transaction, sourceKeypair);

    // Submit with throttling
    const result = await StellarServiceWithThrottling.submitTransactionThrottled(transaction);

    console.log(`✓ Transaction submitted successfully`);
    console.log(`  Hash: ${result.hash}`);
    console.log(`  Ledger: ${result.ledger}`);
  } catch (error) {
    console.error('✗ Transaction failed:', error);
  }
}

// Example 2: Priority Transaction
async function example2_priorityTransaction() {
  console.log('\n=== Example 2: Priority Transaction ===\n');

  const throttlingService = StellarThrottlingService.getInstance();
  const sourceKeypair = Keypair.random();
  const destinationPublicKey = Keypair.random().publicKey();

  try {
    const transaction = await StellarService.createPaymentTransaction(
      sourceKeypair,
      destinationPublicKey,
      '1000'
    );

    StellarService.signTransaction(transaction, sourceKeypair);

    // Submit with high priority (jumps the queue)
    const result = await throttlingService.submitTransaction(transaction, {
      priority: true,
      metadata: {
        type: 'urgent_payment',
        reason: 'emergency_withdrawal',
      },
    });

    console.log(`✓ Priority transaction submitted`);
    console.log(`  Hash: ${result.hash}`);
  } catch (error) {
    console.error('✗ Priority transaction failed:', error);
  }
}

// Example 3: Transaction with Retry Logic
async function example3_transactionWithRetry() {
  console.log('\n=== Example 3: Transaction with Retry Logic ===\n');

  const throttlingService = StellarThrottlingService.getInstance();
  const sourceKeypair = Keypair.random();
  const destinationPublicKey = Keypair.random().publicKey();

  try {
    const transaction = await StellarService.createPaymentTransaction(
      sourceKeypair,
      destinationPublicKey,
      '50'
    );

    StellarService.signTransaction(transaction, sourceKeypair);

    // Submit with automatic retry on failure
    const result = await throttlingService.submitTransaction(transaction, {
      retryOnFailure: true,
      maxRetries: 3,
      retryDelayMs: 1000, // Exponential backoff will be applied
      metadata: {
        type: 'payment',
        retryEnabled: true,
      },
    });

    console.log(`✓ Transaction submitted (with retry protection)`);
    console.log(`  Hash: ${result.hash}`);
  } catch (error) {
    console.error('✗ Transaction failed after retries:', error);
  }
}

// Example 4: Bulk Transaction Processing
async function example4_bulkTransactions() {
  console.log('\n=== Example 4: Bulk Transaction Processing ===\n');

  const throttlingService = StellarThrottlingService.getInstance();
  const sourceKeypair = Keypair.random();

  // Simulate 20 payments
  const payments = Array.from({ length: 20 }, (_, i) => ({
    destination: Keypair.random().publicKey(),
    amount: `${(i + 1) * 10}`,
    id: `payment-${i + 1}`,
  }));

  console.log(`Processing ${payments.length} payments...`);

  const results = [];
  const startTime = Date.now();

  for (const payment of payments) {
    try {
      const transaction = await StellarService.createPaymentTransaction(
        sourceKeypair,
        payment.destination,
        payment.amount
      );

      StellarService.signTransaction(transaction, sourceKeypair);

      const result = await throttlingService.submitTransaction(transaction, {
        priority: false, // Regular priority
        retryOnFailure: true,
        maxRetries: 2,
        metadata: {
          paymentId: payment.id,
          amount: payment.amount,
        },
      });

      results.push({ id: payment.id, success: true, hash: result.hash });
      console.log(`  ✓ ${payment.id}: ${result.hash}`);
    } catch (error) {
      results.push({ id: payment.id, success: false, error: String(error) });
      console.log(`  ✗ ${payment.id}: Failed`);
    }
  }

  const duration = Date.now() - startTime;
  const successCount = results.filter((r) => r.success).length;

  console.log(`\nBulk processing complete:`);
  console.log(`  Total: ${payments.length}`);
  console.log(`  Successful: ${successCount}`);
  console.log(`  Failed: ${payments.length - successCount}`);
  console.log(`  Duration: ${duration}ms`);
  console.log(`  Average: ${(duration / payments.length).toFixed(2)}ms per transaction`);
}

// Example 5: Monitoring Throttling Status
async function example5_monitoringStatus() {
  console.log('\n=== Example 5: Monitoring Throttling Status ===\n');

  const throttlingService = StellarThrottlingService.getInstance();

  // Get current status
  const status = throttlingService.getStatus();
  console.log('Current Status:');
  console.log(`  TPM: ${status.tpm}`);
  console.log(`  Available Tokens: ${status.currentTokens}/${status.maxTokens}`);
  console.log(`  Queue Size: ${status.queueSize}/${status.maxQueueSize}`);
  console.log(`  Processed: ${status.processedCount}`);
  console.log(`  Rejected: ${status.rejectedCount}`);
  console.log(`  Is Processing: ${status.isProcessing}`);

  // Get metrics
  const metrics = throttlingService.getMetrics();
  console.log('\nMetrics:');
  console.log(`  Total Submitted: ${metrics.totalSubmitted}`);
  console.log(`  Total Successful: ${metrics.totalSuccessful}`);
  console.log(`  Total Failed: ${metrics.totalFailed}`);
  console.log(`  Total Throttled: ${metrics.totalThrottled}`);
  console.log(`  Average Wait Time: ${metrics.averageWaitTime.toFixed(2)}ms`);
  console.log(`  Current Queue Depth: ${metrics.currentQueueDepth}`);

  if (metrics.totalSubmitted > 0) {
    const successRate = ((metrics.totalSuccessful / metrics.totalSubmitted) * 100).toFixed(2);
    const throttleRate = ((metrics.totalThrottled / metrics.totalSubmitted) * 100).toFixed(2);
    console.log(`  Success Rate: ${successRate}%`);
    console.log(`  Throttle Rate: ${throttleRate}%`);
  }

  // Check capacity
  const hasCapacity = throttlingService.hasCapacity();
  console.log(`\nHas Capacity: ${hasCapacity ? '✓ Yes' : '✗ No'}`);
}

// Example 6: Event Listeners
async function example6_eventListeners() {
  console.log('\n=== Example 6: Event Listeners ===\n');

  const throttlingService = StellarThrottlingService.getInstance();

  // Set up event listeners
  throttlingService.on('stellar:transaction:success', (data) => {
    console.log(`✓ Transaction succeeded: ${data.hash} (waited ${data.waitTime}ms)`);
  });

  throttlingService.on('stellar:transaction:error', (data) => {
    console.error(`✗ Transaction failed: ${data.transactionId} - ${data.error}`);
  });

  throttlingService.on('stellar:transaction:queued', (data) => {
    console.log(`⏳ Transaction queued: ${data.id} at position ${data.queuePosition}`);
  });

  throttlingService.on('config:updated', (config) => {
    console.log(`⚙️  Configuration updated:`, config);
  });

  console.log('Event listeners registered. Submit some transactions to see events...');

  // Submit a test transaction
  const sourceKeypair = Keypair.random();
  const destinationPublicKey = Keypair.random().publicKey();

  try {
    const transaction = await StellarService.createPaymentTransaction(
      sourceKeypair,
      destinationPublicKey,
      '100'
    );

    StellarService.signTransaction(transaction, sourceKeypair);
    await throttlingService.submitTransaction(transaction);
  } catch (error) {
    // Error will be logged by event listener
  }
}

// Example 7: Dynamic Configuration
async function example7_dynamicConfiguration() {
  console.log('\n=== Example 7: Dynamic Configuration ===\n');

  const throttlingService = StellarThrottlingService.getInstance();

  // Get current config
  const currentConfig = throttlingService.getConfig();
  console.log('Current Configuration:');
  console.log(`  TPM: ${currentConfig.tpm}`);
  console.log(`  Max Queue Size: ${currentConfig.maxQueueSize}`);
  console.log(`  Refill Interval: ${currentConfig.refillIntervalMs}ms`);

  // Update configuration
  console.log('\nUpdating configuration...');
  throttlingService.updateConfig({
    tpm: 150,
    maxQueueSize: 1500,
  });

  const newConfig = throttlingService.getConfig();
  console.log('\nNew Configuration:');
  console.log(`  TPM: ${newConfig.tpm}`);
  console.log(`  Max Queue Size: ${newConfig.maxQueueSize}`);
  console.log(`  Refill Interval: ${newConfig.refillIntervalMs}ms`);
}

// Example 8: Handling Queue Full Scenario
async function example8_queueFullHandling() {
  console.log('\n=== Example 8: Handling Queue Full Scenario ===\n');

  const throttlingService = StellarThrottlingService.getInstance();

  // Check capacity before submitting
  if (!throttlingService.hasCapacity()) {
    console.log('⚠️  Warning: Throttling service at capacity');

    const status = throttlingService.getStatus();
    const estimatedWaitTime = (status.queueSize / (status.tpm / 60)) * 1000;

    console.log(`  Queue Size: ${status.queueSize}/${status.maxQueueSize}`);
    console.log(`  Estimated Wait: ${(estimatedWaitTime / 1000).toFixed(2)}s`);

    // Options:
    // 1. Wait and retry
    console.log('\nOption 1: Wait and retry later');

    // 2. Use priority
    console.log('Option 2: Submit with priority flag');

    // 3. Clear queue (admin only)
    console.log('Option 3: Clear queue (requires admin privileges)');

    return;
  }

  console.log('✓ Service has capacity, proceeding with transaction');
}

// Example 9: Payroll Processing with Throttling
async function example9_payrollProcessing() {
  console.log('\n=== Example 9: Payroll Processing with Throttling ===\n');

  const throttlingService = StellarThrottlingService.getInstance();
  const sourceKeypair = Keypair.random();

  // Simulate payroll for 50 employees
  const employees = Array.from({ length: 50 }, (_, i) => ({
    id: `emp-${i + 1}`,
    publicKey: Keypair.random().publicKey(),
    salary: `${1000 + i * 100}`,
  }));

  console.log(`Processing payroll for ${employees.length} employees...`);

  const results = {
    successful: [] as string[],
    failed: [] as string[],
  };

  const startTime = Date.now();

  // Process in batches
  const batchSize = 10;
  for (let i = 0; i < employees.length; i += batchSize) {
    const batch = employees.slice(i, i + batchSize);
    console.log(`\nProcessing batch ${Math.floor(i / batchSize) + 1}...`);

    const batchPromises = batch.map(async (employee) => {
      try {
        const transaction = await StellarService.createPaymentTransaction(
          sourceKeypair,
          employee.publicKey,
          employee.salary
        );

        StellarService.signTransaction(transaction, sourceKeypair);

        const result = await throttlingService.submitTransaction(transaction, {
          priority: false,
          retryOnFailure: true,
          maxRetries: 3,
          metadata: {
            type: 'payroll',
            employeeId: employee.id,
            amount: employee.salary,
          },
        });

        results.successful.push(employee.id);
        return { success: true, employeeId: employee.id, hash: result.hash };
      } catch (error) {
        results.failed.push(employee.id);
        return { success: false, employeeId: employee.id, error: String(error) };
      }
    });

    await Promise.all(batchPromises);
  }

  const duration = Date.now() - startTime;

  console.log(`\n✓ Payroll processing complete:`);
  console.log(`  Total Employees: ${employees.length}`);
  console.log(`  Successful: ${results.successful.length}`);
  console.log(`  Failed: ${results.failed.length}`);
  console.log(`  Duration: ${(duration / 1000).toFixed(2)}s`);
  console.log(`  Throughput: ${((employees.length / duration) * 1000 * 60).toFixed(2)} TPM`);
}

// Main function to run all examples
async function runExamples() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Transaction Throttling Examples                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    // Run examples sequentially
    await example1_basicSubmission();
    await example2_priorityTransaction();
    await example3_transactionWithRetry();
    await example4_bulkTransactions();
    await example5_monitoringStatus();
    await example6_eventListeners();
    await example7_dynamicConfiguration();
    await example8_queueFullHandling();
    await example9_payrollProcessing();

    console.log('\n✓ All examples completed successfully!');
  } catch (error) {
    console.error('\n✗ Error running examples:', error);
  }
}

// Export for use in other files
export {
  example1_basicSubmission,
  example2_priorityTransaction,
  example3_transactionWithRetry,
  example4_bulkTransactions,
  example5_monitoringStatus,
  example6_eventListeners,
  example7_dynamicConfiguration,
  example8_queueFullHandling,
  example9_payrollProcessing,
  runExamples,
};

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runExamples().catch(console.error);
}
