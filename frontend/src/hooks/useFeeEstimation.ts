/**
 * useFeeEstimation Hook
 *
 * React Query hook that polls Horizon fee statistics every 10 seconds and
 * exposes a processed fee recommendation plus a batch estimator helper.
 *
 * Issue: https://github.com/Gildado/PayD/issues/42
 */

import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  getFeeRecommendation,
  estimateBatchPaymentBudget,
  type FeeRecommendation,
  type BatchBudgetEstimate,
} from "../services/feeEstimation";

/** Query key used by React Query for cache management */
const FEE_ESTIMATION_QUERY_KEY = ["fee-estimation"] as const;

/** Polling interval — refresh fee stats every 10 seconds */
const POLL_INTERVAL_MS = 10_000;

export function useFeeEstimation() {
  const {
    data: feeRecommendation,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<FeeRecommendation, Error>({
    queryKey: FEE_ESTIMATION_QUERY_KEY,
    queryFn: getFeeRecommendation,
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: POLL_INTERVAL_MS,
  });

  /**
   * Convenience wrapper that estimates the total fee budget for a batch
   * of `count` payroll transactions.
   */
  const estimateBatch = useCallback(
    async (count: number): Promise<BatchBudgetEstimate> => {
      return estimateBatchPaymentBudget(count);
    },
    [],
  );

  return {
    feeRecommendation,
    isLoading,
    isError,
    error,
    refetch,
    estimateBatch,
  };
}
