/**
 * Envelope stored in localStorage to allow versioned migrations.
 */
export interface LocalStorageEnvelope<T> {
  /**
   * Version number of the stored payload. Used to detect when migration is required.
   */
  v: number;
  /**
   * Actual stored value for the key.
   */
  data: T;
}

/**
 * Options used to configure the `LocalStorageHelper` instance.
 */
export interface LocalStorageOptions<T> {
  /** Current version for values written by this helper. */
  version: number;
  /** Optional migration function invoked when stored value has a different version. */
  migrate?: (raw: unknown, fromVersion: number) => T;
}

/**
 * Helper class that wraps `window.localStorage` with a small envelope format to
 * support versioning and optional migrations.
 *
 * Basic usage:
 * ```ts
 * const helper = new LocalStorageHelper<MyType>('my-key', { version: 1 });
 * helper.set({ foo: 'bar' });
 * const value = helper.get();
 * helper.remove();
 * ```
 */
export class LocalStorageHelper<T> {
  constructor(
    private readonly key: string,
    private readonly options: LocalStorageOptions<T>
  ) {}

  /**
   * Read and parse the stored value from localStorage.
   * Handles JSON parsing and automatic version migration if configured.
   *
   * @returns The stored value of type `T`, or `null` if not found or invalid
   */
  get(): T | null {
    if (typeof window === 'undefined') return null;

    const raw = window.localStorage.getItem(this.key);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object') return null;

      const envelope = parsed as Partial<LocalStorageEnvelope<T>>;
      const version = typeof envelope.v === 'number' ? envelope.v : 1;

      if (version === this.options.version && envelope.data !== undefined) {
        return envelope.data as T;
      }

      if (this.options.migrate) {
        return this.options.migrate(envelope.data, version);
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Persist a value of type `T` under the configured key.
   * Wraps the value in a versioned envelope before storing as a JSON string.
   * No-op during server-side rendering (SSR).
   *
   * @param value - The data to persist
   */
  set(value: T): void {
    if (typeof window === 'undefined') return;
    const payload: LocalStorageEnvelope<T> = {
      v: this.options.version,
      data: value,
    };
    window.localStorage.setItem(this.key, JSON.stringify(payload));
  }

  /**
   * Remove the stored key and its value from localStorage.
   * No-op during server-side rendering (SSR).
   */
  remove(): void {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(this.key);
  }
}
