/**
 * Offline Transaction History Cache
 *
 * Persists the most recently fetched, unfiltered transaction history page in
 * IndexedDB so it can be displayed when the device has no network
 * connection. This only stores the default (page 1, no filters) view since
 * that is the "recent transaction history" snapshot the offline UI shows.
 *
 * The cache intentionally stores a bounded number of items so it stays a
 * small, predictable slice of the overall PWA cache budget (see the
 * `MAX_CACHED_ITEMS` limit below, combined with the Workbox runtime-caching
 * expiration rules configured in vite.config.ts, keeps total cache usage
 * well under the 50MB budget).
 */

import type { TimelineItem } from '../types/transactionHistory';

const DB_NAME = 'payd-offline-cache';
const DB_VERSION = 1;
const STORE_NAME = 'transactionHistory';
const SNAPSHOT_KEY = 'default-page-1';

/** Only the most recent N items are persisted for offline viewing. */
const MAX_CACHED_ITEMS = 100;

export interface HistorySnapshot {
  items: TimelineItem[];
  cachedAt: string;
}

function isIndexedDbAvailable(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDbAvailable()) {
      reject(new Error('IndexedDB is not available in this environment.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open offline cache DB.'));
  });
}

/**
 * Saves the latest unfiltered transaction history snapshot for offline use.
 * Failures are swallowed (logged only) since caching is a best-effort
 * enhancement and should never break the online data flow.
 */
export async function saveHistorySnapshot(items: TimelineItem[]): Promise<void> {
  if (!isIndexedDbAvailable()) return;

  try {
    const db = await openDb();
    const snapshot: HistorySnapshot = {
      items: items.slice(0, MAX_CACHED_ITEMS),
      cachedAt: new Date().toISOString(),
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(snapshot, SNAPSHOT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Failed to write offline cache.'));
    });
    db.close();
  } catch (error) {
    console.warn('Unable to persist transaction history for offline use:', error);
  }
}

/** Reads the last-cached snapshot, or null if none exists yet. */
export async function getHistorySnapshot(): Promise<HistorySnapshot | null> {
  if (!isIndexedDbAvailable()) return null;

  try {
    const db = await openDb();
    const snapshot = await new Promise<HistorySnapshot | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(SNAPSHOT_KEY);
      request.onsuccess = () => resolve((request.result as HistorySnapshot | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error('Failed to read offline cache.'));
    });
    db.close();
    return snapshot;
  } catch (error) {
    console.warn('Unable to read cached transaction history:', error);
    return null;
  }
}

/** Clears the persisted transaction history snapshot (used by Settings). */
export async function clearHistorySnapshot(): Promise<void> {
  if (!isIndexedDbAvailable()) return;

  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(SNAPSHOT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Failed to clear offline cache.'));
    });
    db.close();
  } catch (error) {
    console.warn('Unable to clear cached transaction history:', error);
  }
}

/**
 * Clears every cache this PWA maintains: the IndexedDB transaction history
 * snapshot and every Cache Storage bucket the service worker owns (app
 * shell precache + Workbox runtime API caches). Used by the "Clear cached
 * data" control in Settings.
 */
export async function clearAllOfflineCaches(): Promise<void> {
  await clearHistorySnapshot();

  if (typeof caches !== 'undefined') {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
    } catch (error) {
      console.warn('Unable to clear service worker caches:', error);
    }
  }
}

/** Returns true when a request failed because the device has no network. */
export function isNetworkFailure(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (error instanceof TypeError) return true;
  if (error && typeof error === 'object' && 'errorState' in error) {
    const errorState = (error as { errorState?: { type?: string } }).errorState;
    return errorState?.type === 'network';
  }
  return false;
}
