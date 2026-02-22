/**
 * useTransactionSimulation Hook
 *
 * Provides a managed interface for simulating Stellar transactions before submission.
 * Handles loading states, results management, and batch operations.
 *
 * Issue: https://github.com/Gildado/PayD/issues/41
 */

import { useState, useCallback } from "react";
import {
  simulateTransaction,
  simulateBatchTransactions,
  summarizeBatchSimulation,
  type SimulationResult,
  type SimulationOptions,
} from "../services/transactionSimulation";

export function useTransactionSimulation() {
  const [isSimulating, setIsSimulating] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [batchResult, setBatchResult] = useState<ReturnType<
    typeof summarizeBatchSimulation
  > | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Simulates a single transaction.
   */
  const simulate = useCallback(async (options: SimulationOptions) => {
    setIsSimulating(true);
    setError(null);
    setResult(null);
    setBatchResult(null);

    try {
      const simResult = await simulateTransaction(options);
      setResult(simResult);
      return simResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Simulation failed";
      setError(message);
      return null;
    } finally {
      setIsSimulating(false);
    }
  }, []);

  /**
   * Simulates a batch of transactions.
   */
  const simulateBatch = useCallback(
    async (xdrs: string[], horizonUrl?: string) => {
      setIsSimulating(true);
      setError(null);
      setResult(null);
      setBatchResult(null);

      try {
        const results = await simulateBatchTransactions(xdrs, horizonUrl);
        const summary = summarizeBatchSimulation(results);
        setBatchResult(summary);
        return summary;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Batch simulation failed";
        setError(message);
        return null;
      } finally {
        setIsSimulating(false);
      }
    },
    [],
  );

  /**
   * Resets the simulation state.
   */
  const resetSimulation = useCallback(() => {
    setIsSimulating(false);
    setResult(null);
    setBatchResult(null);
    setError(null);
  }, []);

  return {
    simulate,
    simulateBatch,
    resetSimulation,
    isSimulating,
    result,
    batchResult,
    error,
    /** Helper to check if the current (last) simulation was successful */
    isSuccess: result?.success ?? batchResult?.allPassed ?? false,
  };
}
