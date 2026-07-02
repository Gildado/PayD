import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  runPreflightChecks,
  type PreflightCheckEmployee,
  type PreflightCheckResult,
} from '../services/preflightCheck';

const PREFLIGHT_CHECK_KEY = 'preflight-check';

export interface PreflightCheckSummary {
  totalPassed: number;
  totalFailed: number;
  hasIssues: boolean;
  readyToSubmit: boolean;
}

export function usePreflightCheck(batch: PreflightCheckEmployee[]) {
  const queryKey = useMemo(
    () => [PREFLIGHT_CHECK_KEY, batch] as const,
    [batch]
  );

  const {
    data,
    isLoading,
    refetch,
  } = useQuery<PreflightCheckResult[], Error>({
    queryKey,
    queryFn: () => runPreflightChecks(batch),
    enabled: batch.length > 0,
    staleTime: Infinity,
  });

  const summary = useMemo((): PreflightCheckSummary => {
    const results = data ?? [];
    const totalPassed = results.filter((r) => r.status === 'pass').length;
    const totalFailed = results.filter((r) => r.status === 'fail').length;
    return {
      totalPassed,
      totalFailed,
      hasIssues: totalFailed > 0,
      readyToSubmit: !isLoading && results.length > 0 && totalFailed === 0,
    };
  }, [data, isLoading]);

  return {
    results: data ?? [],
    isRunning: isLoading,
    summary,
    rerun: () => {
      void refetch();
    },
  };
}
