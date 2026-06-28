import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocket } from './useSocket';

const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3000';

const POLLING_INTERVAL_MS = 10_000;

export interface TransactionLiveStatus {
  status: string | null;
  txHash: string | null;
  /** Whether the status is being pushed via WebSocket (vs. polled). */
  isLive: boolean;
  /** ISO timestamp of the last status update received. */
  updatedAt: string | null;
}

/**
 * Subscribe to real-time updates for a single transaction hash.
 *
 * - When the socket is connected, joins the `transaction:<txHash>` room and
 *   listens for `transaction:update` events.
 * - When the socket is disconnected or polling fallback is active, polls the
 *   audit API every {@link POLLING_INTERVAL_MS} ms for a fresh status.
 */
export function useTransactionUpdates(txHash: string | null | undefined): TransactionLiveStatus {
  const {
    socket,
    connected,
    isPollingFallback,
    subscribeToTransaction,
    unsubscribeFromTransaction,
  } = useSocket();

  const [status, setStatus] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Helper: poll the audit API for the latest status ──────────────────
  const pollStatus = useCallback(async () => {
    if (!txHash) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/audit?search=${encodeURIComponent(txHash)}&limit=1`
      );
      if (!res.ok) return;
      const payload = (await res.json()) as { data?: Array<{ successful?: boolean }> };
      const row = payload.data?.[0];
      if (!row) return;
      const polledStatus = row.successful === false ? 'failed' : 'confirmed';
      setStatus(polledStatus);
      setUpdatedAt(new Date().toISOString());
    } catch {
      // silently ignore poll errors
    }
  }, [txHash]);

  // ── WebSocket listener ─────────────────────────────────────────────────
  useEffect(() => {
    if (!txHash || !socket) return;

    const onUpdate = (payload: { transactionId: string; status: string; timestamp: string }) => {
      if (payload.transactionId !== txHash) return;
      setStatus(payload.status);
      setUpdatedAt(payload.timestamp);
    };

    if (connected) {
      subscribeToTransaction(txHash);
      socket.on('transaction:update', onUpdate);
    }

    return () => {
      if (connected) {
        unsubscribeFromTransaction(txHash);
      }
      socket.off('transaction:update', onUpdate);
    };
  }, [txHash, socket, connected, subscribeToTransaction, unsubscribeFromTransaction]);

  // ── Polling fallback ───────────────────────────────────────────────────
  useEffect(() => {
    if (!txHash) return;

    const shouldPoll = !connected || isPollingFallback;

    if (shouldPoll) {
      void pollStatus(); // immediate first poll
      pollingRef.current = setInterval(() => {
        void pollStatus();
      }, POLLING_INTERVAL_MS);
    } else {
      if (pollingRef.current !== null) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }

    return () => {
      if (pollingRef.current !== null) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [txHash, connected, isPollingFallback, pollStatus]);

  return {
    status,
    txHash: txHash ?? null,
    isLive: connected && !isPollingFallback,
    updatedAt,
  };
}
