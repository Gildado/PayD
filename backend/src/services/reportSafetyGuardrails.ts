import logger from '../utils/logger.js';
import { SafetyValidation, SafetyValidationZod, PIIFieldType } from './reportSchema.js';

/**
 * Patterns for detecting common SQL injection attempts
 */
const SQL_INJECTION_PATTERNS = [
  /(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|SCRIPT)\b)/gi,
  /(-{2}|\/\*|\*\/|;|xp_|sp_)/gi,
  /(\bOR\b\s+\d+\s*=\s*\d+)/gi,
  /(\bAND\b.*\bOR\b)/gi,
  /(CASE\s+WHEN)/gi,
  /(<|>|!=|<>)\s*\(/gi,
];

/**
 * PII detection patterns
 */
const PII_PATTERNS = {
  [PIIFieldType.EMAIL]: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  [PIIFieldType.PHONE]: /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
  [PIIFieldType.SSN]: /\b\d{3}-\d{2}-\d{4}\b/g,
  [PIIFieldType.CREDIT_CARD]: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  [PIIFieldType.NAME]: /\b([A-Z][a-z]+\s[A-Z][a-z]+)\b/g,
  [PIIFieldType.ADDRESS]: /\b\d+\s[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd)\b/g,
};

/**
 * Reserved keywords and dangerous functions that should not appear in user queries
 */
const DANGEROUS_KEYWORDS = [
  'UNION',
  'INTERSECT',
  'EXCEPT',
  'EXEC',
  'EXECUTE',
  'SCRIPT',
  'DROP',
  'TRUNCATE',
  'ALTER',
  'CREATE',
  'xp_',
  'sp_',
];

/**
 * Report Safety Guardrails Service
 * Prevents SQL injection, PII leakage, and malformed queries
 */
export class ReportSafetyGuardrails {
  /**
   * Validates a natural language query and user input
   */
  static async validateQuery(
    query: string,
    userInput: Record<string, any> = {}
  ): Promise<SafetyValidation> {
    const issues: SafetyValidation['issues'] = [];
    const piiDetected: PIIFieldType[] = [];
    let isValid = true;

    // 1. Check for SQL injection patterns
    const sqlInjectionIssues = this.detectSQLInjection(query);
    if (sqlInjectionIssues.length > 0) {
      issues.push(...sqlInjectionIssues);
      isValid = false;
    }

    // 2. Check for dangerous keywords
    const dangerousKeywordIssues = this.detectDangerousKeywords(query);
    if (dangerousKeywordIssues.length > 0) {
      issues.push(...dangerousKeywordIssues);
      isValid = false;
    }

    // 3. Detect PII in query and user input
    const detectedPII = this.detectPII(query);
    const inputPII = this.detectPIIInObject(userInput);
    piiDetected.push(...detectedPII, ...inputPII);

    if (piiDetected.length > 0) {
      issues.push({
        type: 'PII_EXPOSURE',
        severity: 'HIGH',
        message: `Potential PII detected: ${piiDetected.join(', ')}`,
      });
      isValid = false;
    }

    // 4. Check for malformed queries
    const malformedIssues = this.detectMalformedQuery(query);
    if (malformedIssues.length > 0) {
      issues.push(...malformedIssues);
      isValid = false;
    }

    // 5. Sanitize the query
    const sanitizedQuery = this.sanitizeQuery(query);

    logger.info(
      `Query validation: ${isValid ? 'PASSED' : 'FAILED'} - Issues: ${issues.length}, PII detected: ${piiDetected.length}`
    );

    try {
      return SafetyValidationZod.parse({
        isValid,
        issues,
        piiDetected,
        sanitizedQuery,
      });
    } catch (error) {
      logger.error('Safety validation schema error:', error);
      throw new Error('Safety validation failed');
    }
  }

  /**
   * Detects SQL injection patterns in input
   */
  private static detectSQLInjection(
    input: string
  ): SafetyValidation['issues'] {
    const issues: SafetyValidation['issues'] = [];

    for (const pattern of SQL_INJECTION_PATTERNS) {
      const matches = input.match(pattern);
      if (matches) {
        issues.push({
          type: 'SQL_INJECTION',
          severity: 'HIGH',
          message: `SQL injection pattern detected: ${matches[0]}`,
        });
      }
    }

    return issues;
  }

  /**
   * Detects dangerous SQL keywords
   */
  private static detectDangerousKeywords(
    input: string
  ): SafetyValidation['issues'] {
    const issues: SafetyValidation['issues'] = [];
    const upperInput = input.toUpperCase();

    for (const keyword of DANGEROUS_KEYWORDS) {
      if (upperInput.includes(keyword)) {
        issues.push({
          type: 'SQL_INJECTION',
          severity: 'HIGH',
          message: `Dangerous keyword detected: ${keyword}`,
        });
      }
    }

    return issues;
  }

  /**
   * Detects PII in query string
   */
  private static detectPII(query: string): PIIFieldType[] {
    const detected: PIIFieldType[] = [];

    for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
      if (pattern.test(query)) {
        detected.push(type as PIIFieldType);
      }
    }

    return detected;
  }

  /**
   * Detects PII in object values
   */
  private static detectPIIInObject(
    obj: Record<string, any>
  ): PIIFieldType[] {
    const detected: PIIFieldType[] = [];

    const checkValue = (value: any): void => {
      if (typeof value === 'string') {
        for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
          if (pattern.test(value)) {
            detected.push(type as PIIFieldType);
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        Object.values(value).forEach(checkValue);
      }
    };

    Object.values(obj).forEach(checkValue);
    return [...new Set(detected)];
  }

  /**
   * Detects malformed queries
   */
  private static detectMalformedQuery(
    query: string
  ): SafetyValidation['issues'] {
    const issues: SafetyValidation['issues'] = [];

    // Check for unbalanced quotes
    const singleQuotes = (query.match(/'/g) || []).length;
    const doubleQuotes = (query.match(/"/g) || []).length;
    if (singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0) {
      issues.push({
        type: 'MALFORMED_QUERY',
        severity: 'MEDIUM',
        message: 'Unbalanced quotes detected',
      });
    }

    // Check for unbalanced parentheses
    const openParen = (query.match(/\(/g) || []).length;
    const closeParen = (query.match(/\)/g) || []).length;
    if (openParen !== closeParen) {
      issues.push({
        type: 'MALFORMED_QUERY',
        severity: 'MEDIUM',
        message: 'Unbalanced parentheses detected',
      });
    }

    // Check for empty query
    if (query.trim().length === 0) {
      issues.push({
        type: 'MALFORMED_QUERY',
        severity: 'HIGH',
        message: 'Empty query detected',
      });
    }

    return issues;
  }

  /**
   * Sanitizes query by removing dangerous patterns
   */
  private static sanitizeQuery(query: string): string {
    let sanitized = query;

    // Remove SQL comments
    sanitized = sanitized.replace(/--.*$/gm, '');
    sanitized = sanitized.replace(/\/\*[\s\S]*?\*\//g, '');

    // Remove multiple spaces
    sanitized = sanitized.replace(/\s+/g, ' ');

    return sanitized.trim();
  }

  /**
   * Masks sensitive PII data in results
   */
  static maskPIIInResults(
    results: Record<string, any>[],
    piiFields: string[] = []
  ): Record<string, any>[] {
    if (piiFields.length === 0) return results;

    return results.map((record) => {
      const masked = { ...record };
      piiFields.forEach((field) => {
        if (field in masked && masked[field]) {
          const value = String(masked[field]);
          masked[field] = this.maskValue(value);
        }
      });
      return masked;
    });
  }

  /**
   * Masks a single value
   */
  private static maskValue(value: string): string {
    if (value.length <= 2) return '*'.repeat(value.length);
    return value.substring(0, 2) + '*'.repeat(value.length - 2);
  }

  /**
   * Validates user permissions for query execution
   */
  static async validateUserPermissions(
    userId: number,
    organizationId: number,
    queryType: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    // This would integrate with your existing permission/role system
    // Placeholder implementation
    if (!userId || !organizationId) {
      return {
        allowed: false,
        reason: 'Invalid user or organization',
      };
    }

    return { allowed: true };
  }

  /**
   * Validates report output against expected schema
   */
  static validateOutputSchema(
    output: Record<string, any>[],
    expectedSchema: Record<string, string>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!Array.isArray(output)) {
      errors.push('Output must be an array');
      return { valid: false, errors };
    }

    for (const record of output) {
      for (const [field, expectedType] of Object.entries(expectedSchema)) {
        if (!(field in record)) {
          errors.push(`Missing required field: ${field}`);
          continue;
        }

        const actualType = typeof record[field];
        if (actualType !== expectedType && record[field] !== null) {
          errors.push(
            `Field ${field} has type ${actualType}, expected ${expectedType}`
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export default ReportSafetyGuardrails;
