import { useState, useEffect, useCallback } from "react";

/**
 * Custom hook for autosaving form data to localStorage with debouncing.
 *
 * @param key - Unique key for localStorage
 * @param data - The form data to save
 * @param delay - Debounce delay in milliseconds (default: 1000ms)
 * @returns Object containing saving state, lastSaved timestamp, and a clearSavedData function
 */
export function useAutosave<T>(key: string, data: T, delay: number = 1000) {
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Load initial data from local storage if available
  // This helper is intended to be used by the component to initialize its state
  const loadSavedData = useCallback((): T | null => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        const parsed = JSON.parse(item) as unknown;
        return parsed as T;
      }
      return null;
    } catch (error) {
      console.error(`Error loading autosave data for key "${key}":`, error);
      return null;
    }
  }, [key]);

  useEffect(() => {
    // Don't save if data is empty/initial (optional check, depends on use case)
    // For now, we save everything to ensure state sync.

    setSaving(true);

    const handler = setTimeout(() => {
      try {
        window.localStorage.setItem(key, JSON.stringify(data));
        setLastSaved(new Date());
        setSaving(false);
      } catch (error) {
        console.error(`Error autosaving data for key "${key}":`, error);
        setSaving(false);
      }
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [key, data, delay]);

  const clearSavedData = useCallback(() => {
    window.localStorage.removeItem(key);
    setLastSaved(null);
  }, [key]);

  return { saving, lastSaved, loadSavedData, clearSavedData };
}
