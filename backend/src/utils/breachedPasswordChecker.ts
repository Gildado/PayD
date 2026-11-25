/**
 * Breached Password Checker
 * Checks passwords against known breach databases using k-anonymity (HIBP-style).
 * Supports feature flag and local fallback list.
 */

import crypto from 'crypto';

export interface BreachCheckConfig {
  enableBreachCheck: boolean;
  fallbackList: string[];
  apiTimeout: number;
  apiUrl?: string;
}

/**
 * Hashes a password with bcrypt-compatible salting for comparison.
 * Uses the first N bytes for k-anonymity queries to HIBP-style APIs.
 */
export class BreachedPasswordChecker {
  constructor(private config: BreachCheckConfig) {}

  /**
   * Check if a password appears in known breach databases.
   * Uses k-anonymity API if enabled and available, falls back to local list.
   * Never sends plaintext password over the network.
   */
  async isBreached(password: string): Promise<boolean> {
    if (!this.config.enableBreachCheck) {
      return false;
    }

    // Try API first if configured
    if (this.config.apiUrl) {
      try {
        const isBreachedViaAPI = await this.checkViaKAnonymityAPI(password);
        if (isBreachedViaAPI) {
          return true;
        }
      } catch (err) {
        console.warn(
          '[password-checker] K-anonymity API query failed, falling back to local list:',
          err instanceof Error ? err.message : err
        );
        // Fall through to local fallback
      }
    }

    // Check against local fallback list
    return this.checkAgainstLocalFallback(password);
  }

  /**
   * Check via k-anonymity API (HIBP-style).
   * Sends only the first 5 characters of the password hash.
   */
  private async checkViaKAnonymityAPI(password: string): Promise<boolean> {
    const hash = this.hashPassword(password).toUpperCase();
    const prefix = hash.substring(0, 5);
    const suffix = hash.substring(5);

    try {
      const url = `${this.config.apiUrl}${prefix}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.apiTimeout);

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'User-Agent': 'PayD-Password-Checker/1.0' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const text = await response.text();
      const lines = text.split('\r\n');

      // Each line is "SUFFIX:COUNT" where SUFFIX is the remaining hash
      for (const line of lines) {
        const [lineSuffix] = line.split(':');
        if (lineSuffix === suffix) {
          return true; // Password found in breach database
        }
      }

      return false;
    } catch (err) {
      // Re-throw to trigger fallback in caller
      throw err;
    }
  }

  /**
   * Check against local fallback list of common passwords.
   */
  private checkAgainstLocalFallback(password: string): boolean {
    const hash = this.hashPassword(password).toUpperCase();

    for (const breachedHash of this.config.fallbackList) {
      if (this.constantTimeCompare(hash, breachedHash.toUpperCase())) {
        return true;
      }
    }

    return false;
  }

  /**
   * Hash password using SHA-1 (compatible with HIBP API).
   * Not for storage — only for breach checking.
   */
  private hashPassword(password: string): string {
    return crypto.createHash('sha1').update(password, 'utf8').digest('hex');
  }

  /**
   * Constant-time string comparison to prevent timing attacks.
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }
}
