import { useState, useEffect, useCallback, useRef } from 'react';
import { LocalStorageHelper } from '../utils/localStorage';

/**
 * Custom hook for autosaving form data to localStorage with debouncing.
 *
 * @param key - Unique key for localStorage
 * @param data - The form data to save
 * @param delay - Debounce delay in milliseconds (default: 1000ms)
 * @returns Object containing saving state, lastSaved timestamp, saveError, and helper functions
 */
export function useAutosave<T>(key: string, data: T, delay: number = 1000) {
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isFirstSaveCycle = useRef(true);
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
  // This helper is intended to be used by the component to initialize its state
  const loadSavedData = useCallback((): T | null => {
    try {
      return storage.current.get();
    } catch (error) {
      console.error(`Error loading autosave data for key "${key}":`, error);
      return null;
    }
  }, [key]);

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
      try {
        storage.current.set(data);
        setLastSaved(new Date());
        setSaving(false);
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

  const clearSavedData = useCallback(() => {
    storage.current.remove();
    setLastSaved(null);
    setSaveError(null);
  }, []);

  return { saving, lastSaved, saveError, loadSavedData, clearSavedData };
}
