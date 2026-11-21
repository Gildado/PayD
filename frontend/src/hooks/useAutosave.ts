import { useState, useEffect, useCallback, useRef } from 'react';
import { LocalStorageHelper } from '../utils/localStorage';

/**
 * Custom hook for autosaving form data to localStorage with debouncing,
 * offline queueing, and retry handling.
 *
 * @param key - Unique key for localStorage
 * @param data - The form data to save
 * @param delay - Debounce delay in milliseconds (default: 1000ms)
 * @returns Object containing saving state, lastSaved timestamp, saveError, retrySave, isOffline, and helper functions
 */
export function useAutosave<T>(key: string, data: T, delay: number = 1000) {
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  const isFirstSaveCycle = useRef(true);
  const latestDataRef = useRef<T>(data);
  const offlineQueueRef = useRef<T | null>(null);

  latestDataRef.current = data;

  const storage = useRef(
    new LocalStorageHelper<T>(key, {
      version: 1,
      migrate: (raw) => raw as T,
    })
  );

  useEffect(() => {
    storage.current = new LocalStorageHelper<T>(key, {
      version: 1,
      migrate: (raw) => raw as T,
    });
  }, [key]);

  // Load initial data from local storage if available
  const loadSavedData = useCallback((): T | null => {
    try {
      return storage.current.get();
    } catch (error) {
      console.error(`Error loading autosave data for key "${key}":`, error);
      return null;
    }
  }, [key]);

  // Flush queued writes when coming back online
  const flushQueuedWrites = useCallback(() => {
    if (offlineQueueRef.current === null) return;
    const queued = offlineQueueRef.current;
    try {
      storage.current.set(queued);
      setLastSaved(new Date());
      setSaving(false);
      setSaveError(null);
      offlineQueueRef.current = null;
    } catch (error) {
      console.error(`Error flushing offline autosave queue for key "${key}":`, error);
      setSaving(false);
      setSaveError(
        'Draft could not be saved. Storage may be full or unavailable in this browser.'
      );
    }
  }, [key]);

  // Listen to network status changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOffline(false);
      flushQueuedWrites();
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [flushQueuedWrites]);

  useEffect(() => {
    // Skip the first cycle so existing draft state can be restored
    // by the screen without being overwritten by initial defaults.
    if (isFirstSaveCycle.current) {
      isFirstSaveCycle.current = false;
      return;
    }

    setSaving(true);
    setSaveError(null);

    const handler = setTimeout(() => {
      // If offline, queue the write until reconnection
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        offlineQueueRef.current = data;
        setIsOffline(true);
        setSaving(false);
        return;
      }

      try {
        storage.current.set(data);
        setLastSaved(new Date());
        setSaving(false);
        offlineQueueRef.current = null;
      } catch (error) {
        console.error(`Error autosaving data for key "${key}":`, error);
        setSaving(false);
        setSaveError(
          'Draft could not be saved. Storage may be full or unavailable in this browser.'
        );
      }
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [key, data, delay]);

  const retrySave = useCallback(() => {
    setSaving(true);
    setSaveError(null);
    try {
      const dataToSave =
        offlineQueueRef.current !== null ? offlineQueueRef.current : latestDataRef.current;
      storage.current.set(dataToSave);
      setLastSaved(new Date());
      setSaving(false);
      offlineQueueRef.current = null;
    } catch (error) {
      console.error(`Error retrying autosave for key "${key}":`, error);
      setSaving(false);
      setSaveError(
        'Draft could not be saved. Storage may be full or unavailable in this browser.'
      );
    }
  }, [key]);

  const clearSavedData = useCallback(() => {
    storage.current.remove();
    setLastSaved(null);
    setSaveError(null);
    offlineQueueRef.current = null;
  }, []);

  return {
    saving,
    lastSaved,
    saveError,
    retrySave,
    isOffline,
    loadSavedData,
    clearSavedData,
  };
}
