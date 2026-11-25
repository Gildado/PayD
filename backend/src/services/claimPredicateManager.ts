/**
 * ClaimPredicateManager
 * 
 * Manages creation, serialization, and validation of Stellar claimable balance predicates.
 * Supports both unconditional and time-based predicates for flexible claim windows.
 */

import { Claimant } from '@stellar/stellar-sdk';
import logger from '../utils/logger.js';

export type PredicateType = 'unconditional' | 'predicate_time' | 'predicate_before_relative_time';

export interface PredicateData {
  type: PredicateType;
  maxAge?: number; // in seconds
  unit?: string; // 'seconds'
  timestamp?: number; // unix timestamp
  description?: string;
}

export interface PredicateDefinition {
  type: PredicateType;
  data: PredicateData;
  stellarPredicate: any; // Stellar predicate object
}

export class ClaimPredicateManager {
  /**
   * Creates a Stellar predicate object from predicate type and data
   * 
   * @param type Predicate type
   * @param data Predicate data
   * @returns Stellar predicate object
   * @throws Error if predicate type or data is invalid
   */
  static createPredicate(type: PredicateType, data?: PredicateData): any {
    switch (type) {
      case 'unconditional':
        return Claimant.predicateUnconditional();

      case 'predicate_before_relative_time':
        if (!data?.maxAge || !Number.isFinite(data.maxAge) || data.maxAge <= 0) {
          throw new Error(
            'maxAge must be a positive number (in seconds) for predicate_before_relative_time'
          );
        }
        // Relative time predicate: must claim within maxAge seconds from creation
        return Claimant.predicateBeforeRelativeTime(data.maxAge);

      case 'predicate_time':
        if (!data?.timestamp || !Number.isFinite(data.timestamp) || data.timestamp <= 0) {
          throw new Error('timestamp must be a valid unix timestamp for predicate_time');
        }
        // Absolute time predicate: must claim before specific unix timestamp
        return Claimant.predicateBeforeAbsoluteTime(data.timestamp.toString());

      default:
        throw new Error(`Unknown predicate type: ${type}`);
    }
  }

  /**
   * Validates that predicate data is well-formed
   * 
   * @param type Predicate type
   * @param data Predicate data
   * @returns { valid: boolean, errors: string[] }
   */
  static validatePredicate(type: PredicateType, data?: PredicateData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!type) {
      errors.push('Predicate type is required');
      return { valid: false, errors };
    }

    if (!['unconditional', 'predicate_time', 'predicate_before_relative_time'].includes(type)) {
      errors.push(`Unknown predicate type: ${type}`);
    }

    if (type === 'predicate_before_relative_time') {
      if (!data?.maxAge) {
        errors.push('maxAge is required for predicate_before_relative_time');
      } else if (!Number.isFinite(data.maxAge) || data.maxAge <= 0) {
        errors.push('maxAge must be a positive number (in seconds)');
      } else if (data.maxAge > 157_680_000) {
        // ~5 years
        errors.push('maxAge cannot exceed 157680000 seconds (~5 years)');
      }
    }

    if (type === 'predicate_time') {
      if (!data?.timestamp) {
        errors.push('timestamp is required for predicate_time');
      } else if (!Number.isFinite(data.timestamp) || data.timestamp <= 0) {
        errors.push('timestamp must be a valid positive unix timestamp');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Serializes a predicate to JSON for database storage
   * 
   * @param type Predicate type
   * @param data Predicate data
   * @returns JSON serializable predicate data
   */
  static predicateToJson(type: PredicateType, data?: PredicateData): PredicateData {
    const validation = this.validatePredicate(type, data);
    if (!validation.valid) {
      throw new Error(`Invalid predicate: ${validation.errors.join('; ')}`);
    }

    return {
      type,
      maxAge: data?.maxAge,
      unit: data?.unit || 'seconds',
      timestamp: data?.timestamp,
      description: data?.description || this.getPredicateDescription(type, data),
    };
  }

  /**
   * Deserializes predicate data from database storage
   * 
   * @param json Predicate data from database
   * @returns Deserialized predicate data
   */
  static predicateFromJson(json: any): { type: PredicateType; data: PredicateData } {
    if (!json || typeof json !== 'object') {
      throw new Error('Invalid predicate JSON');
    }

    const type = json.type as PredicateType;
    const validation = this.validatePredicate(type, json);

    if (!validation.valid) {
      throw new Error(`Invalid predicate from JSON: ${validation.errors.join('; ')}`);
    }

    return {
      type,
      data: {
        type,
        maxAge: json.maxAge,
        unit: json.unit || 'seconds',
        timestamp: json.timestamp,
        description: json.description,
      },
    };
  }

  /**
   * Generates a human-readable description of the predicate
   * 
   * @param type Predicate type
   * @param data Predicate data
   * @returns Description string
   */
  static getPredicateDescription(type: PredicateType, data?: PredicateData): string {
    switch (type) {
      case 'unconditional':
        return 'No time restrictions. Can be claimed at any time.';

      case 'predicate_before_relative_time':
        if (!data?.maxAge) return 'Invalid: maxAge required';
        const days = Math.round(data.maxAge / 86400);
        return `Must be claimed within ${data.maxAge} seconds (${days} days) of creation.`;

      case 'predicate_time':
        if (!data?.timestamp) return 'Invalid: timestamp required';
        const expiryDate = new Date(data.timestamp * 1000).toISOString();
        return `Must be claimed before ${expiryDate}.`;

      default:
        return 'Unknown predicate';
    }
  }

  /**
   * Calculates the absolute expiry time based on predicate type and optional creation time
   * Useful for database queries and notifications
   * 
   * @param type Predicate type
   * @param data Predicate data
   * @param createdAt Optional creation timestamp (defaults to now)
   * @returns Absolute expiry timestamp in ms, or null if unconditional
   */
  static getExpiryTimestamp(type: PredicateType, data?: PredicateData, createdAt?: number): number | null {
    const created = createdAt || Date.now();

    switch (type) {
      case 'unconditional':
        return null; // No expiry

      case 'predicate_before_relative_time':
        if (!data?.maxAge) return null;
        return created + data.maxAge * 1000;

      case 'predicate_time':
        if (!data?.timestamp) return null;
        return data.timestamp * 1000;

      default:
        return null;
    }
  }

  /**
   * Checks if a balance with the given predicate has expired
   * 
   * @param type Predicate type
   * @param data Predicate data
   * @param createdAt Balance creation timestamp
   * @param now Current time (defaults to now)
   * @returns true if expired, false otherwise
   */
  static isExpired(type: PredicateType, data?: PredicateData, createdAt?: number, now?: number): boolean {
    const expiryMs = this.getExpiryTimestamp(type, data, createdAt);
    if (expiryMs === null) return false; // Unconditional never expires

    const currentTime = now || Date.now();
    return currentTime > expiryMs;
  }

  /**
   * Returns time remaining until expiry in milliseconds
   * 
   * @param type Predicate type
   * @param data Predicate data
   * @param createdAt Balance creation timestamp
   * @param now Current time (defaults to now)
   * @returns Milliseconds until expiry, or null if unconditional
   */
  static getTimeToExpiry(type: PredicateType, data?: PredicateData, createdAt?: number, now?: number): number | null {
    const expiryMs = this.getExpiryTimestamp(type, data, createdAt);
    if (expiryMs === null) return null;

    const currentTime = now || Date.now();
    return Math.max(0, expiryMs - currentTime);
  }
}
