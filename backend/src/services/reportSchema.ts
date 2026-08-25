import { z } from 'zod';

/**
 * Report execution status enum
 */
export enum ReportExecutionStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

/**
 * Report output format enum
 */
export enum ReportFormat {
  JSON = 'JSON',
  CSV = 'CSV',
  XLSX = 'XLSX',
  PDF = 'PDF',
}

/**
 * Delivery channel enum
 */
export enum DeliveryChannel {
  EMAIL = 'EMAIL',
  WEBHOOK = 'WEBHOOK',
  IN_APP = 'IN_APP',
}

/**
 * PII field types for detection
 */
export enum PIIFieldType {
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  SSN = 'SSN',
  CREDIT_CARD = 'CREDIT_CARD',
  NAME = 'NAME',
  ADDRESS = 'ADDRESS',
}

/**
 * Report schema definition
 */
export const ReportSchemaZod = z.object({
  id: z.string().uuid(),
  organizationId: z.number().positive(),
  agentId: z.string(),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  queryType: z.enum(['PAYROLL', 'TRANSACTIONS', 'AUDIT', 'CUSTOM']),
  outputSchema: z.record(z.any()),
  filters: z.record(z.any()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.number().positive(),
});

/**
 * Report execution schema
 */
export const ReportExecutionZod = z.object({
  id: z.string().uuid(),
  reportId: z.string().uuid(),
  status: z.nativeEnum(ReportExecutionStatus),
  startedAt: z.date(),
  completedAt: z.date().optional(),
  error: z.string().optional(),
  rowCount: z.number().nonnegative().optional(),
  fileSize: z.number().positive().optional(),
  filePath: z.string().optional(),
  executedBy: z.number().positive(),
});

/**
 * Report result schema
 */
export const ReportResultZod = z.object({
  executionId: z.string().uuid(),
  format: z.nativeEnum(ReportFormat),
  data: z.array(z.record(z.any())).optional(),
  summary: z.object({
    totalRecords: z.number().nonnegative(),
    processedRecords: z.number().nonnegative(),
    failedRecords: z.number().nonnegative(),
    generatedAt: z.date(),
    generatedBy: z.number().positive(),
  }),
  metadata: z.object({
    version: z.string(),
    schema: z.string(),
    checksum: z.string(),
  }),
});

/**
 * Delivery configuration schema
 */
export const DeliveryConfigZod = z.object({
  id: z.string().uuid(),
  reportId: z.string().uuid(),
  channel: z.nativeEnum(DeliveryChannel),
  enabled: z.boolean().default(true),
  config: z.object({
    // Email config
    recipients: z.array(z.string().email()).optional(),
    subject: z.string().optional(),
    template: z.string().optional(),
    // Webhook config
    url: z.string().url().optional(),
    headers: z.record(z.string()).optional(),
    // In-app config
    notificationTitle: z.string().optional(),
    notificationMessage: z.string().optional(),
  }),
  retryPolicy: z.object({
    maxRetries: z.number().nonnegative().default(3),
    backoffMs: z.number().positive().default(1000),
    backoffMultiplier: z.number().positive().default(2),
  }).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Safety validation result schema
 */
export const SafetyValidationZod = z.object({
  isValid: z.boolean(),
  issues: z.array(z.object({
    type: z.enum(['SQL_INJECTION', 'PII_EXPOSURE', 'MALFORMED_QUERY']),
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    message: z.string(),
    field: z.string().optional(),
  })).default([]),
  piiDetected: z.array(z.nativeEnum(PIIFieldType)).default([]),
  sanitizedQuery: z.string().optional(),
});

/**
 * Access policy schema
 */
export const AccessPolicyZod = z.object({
  id: z.string().uuid(),
  reportId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  rules: z.array(z.object({
    type: z.enum(['ROLE_BASED', 'USER_BASED', 'ORG_BASED']),
    value: z.string(),
    action: z.enum(['ALLOW', 'DENY']),
    fields: z.array(z.string()).optional(), // Fields user can see
  })),
  rowLevelSecurity: z.object({
    enabled: z.boolean(),
    filters: z.array(z.object({
      column: z.string(),
      operator: z.enum(['=', '!=', '>', '<', 'IN', 'LIKE']),
      value: z.string().or(z.array(z.string())),
    })),
  }).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Type exports from schemas
 */
export type ReportSchema = z.infer<typeof ReportSchemaZod>;
export type ReportExecution = z.infer<typeof ReportExecutionZod>;
export type ReportResult = z.infer<typeof ReportResultZod>;
export type DeliveryConfig = z.infer<typeof DeliveryConfigZod>;
export type SafetyValidation = z.infer<typeof SafetyValidationZod>;
export type AccessPolicy = z.infer<typeof AccessPolicyZod>;

/**
 * Report agent interface
 */
export interface IReportAgent {
  id: string;
  name: string;
  description?: string;
  execute(filters?: Record<string, any>): Promise<ReportResult>;
  validate(): Promise<SafetyValidation>;
}

/**
 * Report delivery interface
 */
export interface IReportDelivery {
  channel: DeliveryChannel;
  deliver(result: ReportResult, config: DeliveryConfig): Promise<void>;
  validateConfig(config: DeliveryConfig): Promise<boolean>;
}

/**
 * Fixture data interface
 */
export interface ReportFixture {
  name: string;
  description: string;
  queryType: string;
  filters?: Record<string, any>;
  expectedRowCount: number;
  expectedSchema: Record<string, string>;
  sampleOutput: Record<string, any>[];
}
