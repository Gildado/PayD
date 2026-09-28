# Design Document: Email and Push Notification Service for Payment

## Overview

This document describes the design for a notification service that sends email and push notifications to employees when they receive payments through the PayD system. The service integrates with third-party email providers (Resend or SendGrid) and operates asynchronously through a queue-based architecture to ensure payment processing is not blocked by notification delivery.

### Key Design Goals

1. **Asynchronous Processing**: Notifications are triggered via queue workers after on-chain transaction confirmation, ensuring payment processing remains fast and reliable
2. **Provider Flexibility**: Support multiple email providers (Resend, SendGrid) with a pluggable architecture
3. **Resilience**: Robust error handling with retry logic and graceful degradation when notifications fail
4. **Observability**: Comprehensive tracking of notification delivery status for monitoring and troubleshooting
5. **Security**: Protection of sensitive employee payment data through encryption, redaction, and secure transmission
6. **Localization**: Support for multiple languages and locale-specific formatting

## Architecture

### High-Level Architecture

The notification service follows an event-driven architecture integrated with the existing PayD infrastructure:

```
┌─────────────────┐
│  Payroll Worker │
│  (Existing)     │
└────────┬────────┘
         │ On-chain confirmation
         ▼
┌─────────────────────────┐
│  Notification Queue     │
│  (Bull/Redis)           │
└────────┬────────────────┘
         │ Dequeue job
         ▼
┌─────────────────────────┐
│  Notification Worker    │
│  - Fetch payment data   │
│  - Render templates     │
│  - Send notifications   │
└────────┬────────────────┘
         │
         ├──────────────────┬──────────────────┐
         ▼                  ▼                  ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Email        │   │ Push         │   │ Notification │
│ Provider     │   │ Notification │   │ Tracking DB  │
│ (Resend/     │   │ Service      │   │              │
│  SendGrid)   │   │              │   │              │
└──────────────┘   └──────────────┘   └──────────────┘
```

### Integration Points

1. **Payroll Worker**: After successful Stellar transaction submission, enqueues notification job
2. **Bull Queue**: Existing queue infrastructure (backend/src/config/queue.ts) extended with notification queue
3. **Database**: PostgreSQL for notification tracking and employee data retrieval
4. **Email Providers**: HTTP APIs for Resend and SendGrid
5. **Push Notification Service**: Integration point for future mobile/web push notifications

### Component Responsibilities

- **NotificationQueueService**: Enqueues notification jobs with payment transaction data
- **NotificationWorker**: Processes notification jobs from queue with retry logic
- **NotificationService**: Core orchestration layer that coordinates email and push delivery
- **EmailProviderFactory**: Creates appropriate email provider instance based on configuration
- **EmailProvider Interface**: Abstract interface implemented by Resend and SendGrid adapters
- **TemplateRenderer**: Renders HTML and plain text email templates with payment data
- **NotificationTrackingService**: Records delivery status and provides query interface
- **PushNotificationService**: Handles push notification delivery (future implementation)

## Components and Interfaces

### 1. NotificationQueueService

Responsible for enqueuing notification jobs after payment confirmation.

```typescript
interface NotificationJobData {
  transactionId: number;
  transactionHash: string;
  employeeId: number;
  organizationId: number;
  amount: string;
  assetCode: string;
  timestamp: string;
}

class NotificationQueueService {
  async enqueuePaymentNotification(data: NotificationJobData): Promise<void>;
  async getJobStatus(jobId: string): Promise<JobStatus>;
}
```

**Integration**: Called from payrollWorker.ts after successful transaction submission.

### 2. NotificationWorker

Background worker that processes notification jobs from the queue.

```typescript
class NotificationWorker {
  constructor(
    private notificationService: NotificationService,
    private trackingService: NotificationTrackingService
  )

  async processJob(job: Job<NotificationJobData>): Promise<void>
}
```

**Behavior**:

- Retrieves employee details from database
- Calls NotificationService to send email and push notifications
- Records delivery status via NotificationTrackingService
- Implements exponential backoff retry (3 attempts)

### 3. NotificationService

Core service that orchestrates notification delivery.

```typescript
interface NotificationOptions {
  organizationId: number;
  employeeId: number;
  transactionHash: string;
  amount: string;
  assetCode: string;
  timestamp: string;
}

class NotificationService {
  constructor(
    private emailProvider: IEmailProvider,
    private pushService: PushNotificationService,
    private templateRenderer: TemplateRenderer,
    private configService: NotificationConfigService
  )

  async sendPaymentNotification(options: NotificationOptions): Promise<NotificationResult>
  private async sendEmail(employee: Employee, data: PaymentData): Promise<EmailResult>
  private async sendPush(employee: Employee, data: PaymentData): Promise<PushResult>
}

interface NotificationResult {
  email: EmailResult;
  push: PushResult;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface PushResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
```

### 4. Email Provider Architecture

**IEmailProvider Interface**:

```typescript
interface EmailMessage {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
}

interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface IEmailProvider {
  send(message: EmailMessage): Promise<EmailSendResult>;
  validateConfig(): Promise<boolean>;
}
```

**EmailProviderFactory**:

```typescript
enum EmailProviderType {
  RESEND = "resend",
  SENDGRID = "sendgrid",
}

class EmailProviderFactory {
  static create(
    type: EmailProviderType,
    config: EmailProviderConfig,
  ): IEmailProvider;
}
```

**Provider Implementations**:

```typescript
class ResendEmailProvider implements IEmailProvider {
  constructor(private apiKey: string, private fromEmail: string)
  async send(message: EmailMessage): Promise<EmailSendResult>
  async validateConfig(): Promise<boolean>
}

class SendGridEmailProvider implements IEmailProvider {
  constructor(private apiKey: string, private fromEmail: string)
  async send(message: EmailMessage): Promise<EmailSendResult>
  async validateConfig(): Promise<boolean>
}
```

### 5. TemplateRenderer

Renders email templates with payment data and localization support.

```typescript
interface TemplateData {
  employeeFirstName: string;
  employeeLastName: string;
  amount: string;
  currency: string;
  transactionHash: string;
  transactionUrl: string;
  paymentDate: string;
  organizationName: string;
  locale: string;
}

class TemplateRenderer {
  renderHtml(templateName: string, data: TemplateData): string;
  renderText(templateName: string, data: TemplateData): string;
  private escapeHtml(text: string): string;
  private formatCurrency(
    amount: string,
    currency: string,
    locale: string,
  ): string;
  private formatDate(date: string, locale: string): string;
}
```

**Template Structure**:

- Templates stored in `backend/src/templates/notifications/`
- Separate HTML and text versions
- Support for multiple languages (en, es, fr, etc.)
- Naming convention: `payment-notification.{locale}.html`

### 6. NotificationTrackingService

Records and queries notification delivery status.

```typescript
interface NotificationRecord {
  id: number;
  transactionId: number;
  employeeId: number;
  organizationId: number;
  notificationType: "email" | "push";
  status: "sent" | "failed" | "pending";
  messageId?: string;
  errorMessage?: string;
  sentAt?: Date;
  createdAt: Date;
}

class NotificationTrackingService {
  async recordEmailSent(
    transactionId: number,
    employeeId: number,
    organizationId: number,
    messageId: string,
  ): Promise<void>;

  async recordEmailFailed(
    transactionId: number,
    employeeId: number,
    organizationId: number,
    error: string,
  ): Promise<void>;

  async recordPushSent(
    transactionId: number,
    employeeId: number,
    organizationId: number,
    messageId: string,
  ): Promise<void>;

  async recordPushFailed(
    transactionId: number,
    employeeId: number,
    organizationId: number,
    error: string,
  ): Promise<void>;

  async getNotificationHistory(
    employeeId: number,
    organizationId: number,
    options?: QueryOptions,
  ): Promise<NotificationRecord[]>;

  async getNotificationByTransaction(
    transactionId: number,
    organizationId: number,
  ): Promise<NotificationRecord[]>;
}
```

### 7. NotificationConfigService

Manages organization-specific notification preferences.

```typescript
interface NotificationConfig {
  organizationId: number;
  emailEnabled: boolean;
  pushEnabled: boolean;
  emailProvider: EmailProviderType;
  fromEmail: string;
  fromName: string;
  locale: string;
}

class NotificationConfigService {
  async getConfig(organizationId: number): Promise<NotificationConfig>;
  async updateConfig(
    organizationId: number,
    config: Partial<NotificationConfig>,
  ): Promise<void>;
}
```

### 8. PushNotificationService

Handles push notification delivery (initial stub implementation).

```typescript
interface PushToken {
  employeeId: number;
  token: string;
  platform: "ios" | "android" | "web";
  createdAt: Date;
}

class PushNotificationService {
  async send(
    employeeId: number,
    title: string,
    body: string,
    data: Record<string, string>,
  ): Promise<PushResult>;

  async registerToken(
    employeeId: number,
    token: string,
    platform: string,
  ): Promise<void>;
  async removeToken(employeeId: number, token: string): Promise<void>;
}
```

## Data Models

### Database Schema Extensions

**notifications table**:

```sql
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  notification_type VARCHAR(20) NOT NULL CHECK (notification_type IN ('email', 'push')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  message_id VARCHAR(255),
  error_message TEXT,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_transaction_id ON notifications(transaction_id);
CREATE INDEX idx_notifications_employee_id ON notifications(employee_id);
CREATE INDEX idx_notifications_organization_id ON notifications(organization_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
```

**notification_configs table**:

```sql
CREATE TABLE notification_configs (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  email_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT false,
  email_provider VARCHAR(20) NOT NULL CHECK (email_provider IN ('resend', 'sendgrid')),
  from_email VARCHAR(255) NOT NULL,
  from_name VARCHAR(255) NOT NULL,
  locale VARCHAR(10) DEFAULT 'en',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notification_configs_organization_id ON notification_configs(organization_id);
```

**push_tokens table**:

```sql
CREATE TABLE push_tokens (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  token VARCHAR(512) NOT NULL,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(employee_id, token)
);

CREATE INDEX idx_push_tokens_employee_id ON push_tokens(employee_id);
CREATE INDEX idx_push_tokens_token ON push_tokens(token);
```

**employees table extension**:

```sql
-- Add locale preference column to existing employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS locale VARCHAR(10) DEFAULT 'en';
```

### Environment Configuration

New environment variables required:

```bash
# Email Provider Configuration
EMAIL_PROVIDER=resend  # or 'sendgrid'
EMAIL_FROM_ADDRESS=noreply@payd.example.com
EMAIL_FROM_NAME=PayD Payroll System

# Resend Configuration
RESEND_API_KEY=re_xxxxxxxxxxxxx

# SendGrid Configuration
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx

# Notification Queue Configuration
NOTIFICATION_QUEUE_NAME=payment-notifications
NOTIFICATION_RETRY_ATTEMPTS=3
NOTIFICATION_RETRY_DELAY=5000  # milliseconds

# Stellar Explorer URL
STELLAR_EXPLORER_URL=https://stellar.expert/explorer/public/tx
```

## API Specifications

### Internal APIs

These are internal service methods, not exposed as HTTP endpoints.

#### NotificationQueueService.enqueuePaymentNotification

**Purpose**: Enqueue a notification job after payment confirmation

**Parameters**:

```typescript
{
  transactionId: number; // Database transaction ID
  transactionHash: string; // Stellar transaction hash
  employeeId: number; // Employee receiving payment
  organizationId: number; // Organization ID
  amount: string; // Payment amount (decimal string)
  assetCode: string; // Asset code (USDC, XLM, etc.)
  timestamp: string; // ISO 8601 timestamp
}
```

**Returns**: `Promise<void>`

**Error Handling**: Throws error if queue is unavailable

#### NotificationService.sendPaymentNotification

**Purpose**: Send email and push notifications for a payment

**Parameters**:

```typescript
{
  organizationId: number;
  employeeId: number;
  transactionHash: string;
  amount: string;
  assetCode: string;
  timestamp: string;
}
```

**Returns**:

```typescript
{
  email: {
    success: boolean;
    messageId?: string;
    error?: string;
  };
  push: {
    success: boolean;
    messageId?: string;
    error?: string;
  };
}
```

**Behavior**:

- Retrieves employee data from database
- Checks organization notification config
- Skips email if employee has no email address
- Skips push if employee has no registered tokens
- Continues processing even if one notification type fails
- Logs all errors with redacted sensitive data

### HTTP API Endpoints

#### GET /api/notifications/history

**Purpose**: Retrieve notification history for an employee

**Authentication**: Required (JWT)

**Authorization**: Employee can view own history, admin can view all

**Query Parameters**:

- `employee_id` (optional): Filter by employee ID
- `transaction_id` (optional): Filter by transaction ID
- `notification_type` (optional): Filter by type (email, push)
- `status` (optional): Filter by status (sent, failed, pending)
- `page` (default: 1): Page number
- `limit` (default: 20): Results per page

**Response**:

```json
{
  "data": [
    {
      "id": 123,
      "transaction_id": 456,
      "employee_id": 789,
      "notification_type": "email",
      "status": "sent",
      "message_id": "msg_abc123",
      "sent_at": "2024-01-15T10:30:00Z",
      "created_at": "2024-01-15T10:29:55Z"
    }
  ],
  "pagination": {
    "total": 50,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

#### GET /api/notifications/config

**Purpose**: Get organization notification configuration

**Authentication**: Required (JWT)

**Authorization**: Admin only

**Response**:

```json
{
  "organization_id": 1,
  "email_enabled": true,
  "push_enabled": false,
  "email_provider": "resend",
  "from_email": "noreply@payd.example.com",
  "from_name": "PayD Payroll",
  "locale": "en"
}
```

#### PUT /api/notifications/config

**Purpose**: Update organization notification configuration

**Authentication**: Required (JWT)

**Authorization**: Admin only

**Request Body**:

```json
{
  "email_enabled": true,
  "push_enabled": true,
  "from_email": "payroll@company.com",
  "from_name": "Company Payroll",
  "locale": "es"
}
```

**Response**: Updated configuration object

#### POST /api/notifications/push-token

**Purpose**: Register a push notification token for an employee

**Authentication**: Required (JWT)

**Request Body**:

```json
{
  "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "platform": "ios"
}
```

**Response**:

```json
{
  "success": true,
  "message": "Push token registered successfully"
}
```

#### DELETE /api/notifications/push-token

**Purpose**: Remove a push notification token

**Authentication**: Required (JWT)

**Request Body**:

```json
{
  "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
}
```

**Response**:

```json
{
  "success": true,
  "message": "Push token removed successfully"
}
```

### Email Provider APIs

#### Resend API Integration

**Endpoint**: `https://api.resend.com/emails`

**Method**: POST

**Headers**:

```
Authorization: Bearer {RESEND_API_KEY}
Content-Type: application/json
```

**Request Body**:

```json
{
  "from": "PayD <noreply@payd.example.com>",
  "to": ["employee@example.com"],
  "subject": "Payment Received",
  "html": "<html>...</html>",
  "text": "Plain text version..."
}
```

**Success Response** (200):

```json
{
  "id": "msg_abc123xyz"
}
```

**Error Response** (4xx/5xx):

```json
{
  "message": "Error description",
  "name": "validation_error"
}
```

#### SendGrid API Integration

**Endpoint**: `https://api.sendgrid.com/v3/mail/send`

**Method**: POST

**Headers**:

```
Authorization: Bearer {SENDGRID_API_KEY}
Content-Type: application/json
```

**Request Body**:

```json
{
  "personalizations": [
    {
      "to": [{ "email": "employee@example.com" }]
    }
  ],
  "from": {
    "email": "noreply@payd.example.com",
    "name": "PayD"
  },
  "subject": "Payment Received",
  "content": [
    {
      "type": "text/plain",
      "value": "Plain text version..."
    },
    {
      "type": "text/html",
      "value": "<html>...</html>"
    }
  ]
}
```

**Success Response** (202): Empty body with message ID in `X-Message-Id` header

**Error Response** (4xx/5xx):

```json
{
  "errors": [
    {
      "message": "Error description",
      "field": "field_name",
      "help": "Help text"
    }
  ]
}
```

## Integration with Existing Infrastructure

### Payroll Worker Integration

Modify `backend/src/workers/payrollWorker.ts` to enqueue notification jobs after successful transaction submission:

```typescript
// After successful transaction submission (inside chunk processing loop)
const result = await StellarService.submitTransaction(tx);
logger.info(`Chunk ${i + 1} submitted successfully. Tx Hash: ${result.hash}`);

// Update database for items in this chunk
for (const item of chunk) {
  await PayrollBonusService.updateItemStatus(item.id, "completed", result.hash);

  // Log audit entry
  await PayrollAuditService.logTransactionSucceeded(
    payroll_run.organization_id,
    payrollRunId,
    item.id,
    item.employee_id,
    result.hash,
    result.ledger || 0,
    item.amount,
    assetCode,
    item.item_type,
  );

  // NEW: Enqueue notification job
  await notificationQueueService.enqueuePaymentNotification({
    transactionId: item.id,
    transactionHash: result.hash,
    employeeId: item.employee_id,
    organizationId: payroll_run.organization_id,
    amount: item.amount,
    assetCode: assetCode,
    timestamp: new Date().toISOString(),
  });

  completedCount++;
}
```

### Queue Configuration Extension

Extend `backend/src/config/queue.ts`:

```typescript
export const PAYROLL_QUEUE_NAME = "payroll-processing";
export const NOTIFICATION_QUEUE_NAME = "payment-notifications";

export const notificationQueueConfig = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 5000,
  },
  removeOnComplete: {
    age: 86400, // Keep completed jobs for 24 hours
    count: 1000,
  },
  removeOnFail: {
    age: 604800, // Keep failed jobs for 7 days
  },
};
```

### Worker Registration

Extend `backend/src/workers/index.ts`:

```typescript
import { payrollWorker } from "./payrollWorker.js";
import { notificationWorker } from "./notificationWorker.js";
import logger from "../utils/logger.js";

export function startWorkers() {
  logger.info("Starting background workers...");

  // Workers are already initialized and listening
  logger.info("Payroll worker started");
  logger.info("Notification worker started");
}

export function stopWorkers() {
  logger.info("Stopping background workers...");

  return Promise.all([payrollWorker.close(), notificationWorker.close()]);
}
```

### Database Migration

Create migration file `backend/src/db/migrations/00X_add_notifications.sql`:

```sql
-- Add notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  notification_type VARCHAR(20) NOT NULL CHECK (notification_type IN ('email', 'push')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  message_id VARCHAR(255),
  error_message TEXT,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_transaction_id ON notifications(transaction_id);
CREATE INDEX idx_notifications_employee_id ON notifications(employee_id);
CREATE INDEX idx_notifications_organization_id ON notifications(organization_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- Add notification_configs table
CREATE TABLE IF NOT EXISTS notification_configs (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  email_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT false,
  email_provider VARCHAR(20) NOT NULL DEFAULT 'resend' CHECK (email_provider IN ('resend', 'sendgrid')),
  from_email VARCHAR(255) NOT NULL,
  from_name VARCHAR(255) NOT NULL,
  locale VARCHAR(10) DEFAULT 'en',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notification_configs_organization_id ON notification_configs(organization_id);

-- Add push_tokens table
CREATE TABLE IF NOT EXISTS push_tokens (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  token VARCHAR(512) NOT NULL,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(employee_id, token)
);

CREATE INDEX idx_push_tokens_employee_id ON push_tokens(employee_id);
CREATE INDEX idx_push_tokens_token ON push_tokens(token);

-- Add locale column to employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS locale VARCHAR(10) DEFAULT 'en';

-- Add trigger for notifications updated_at
CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_configs_updated_at BEFORE UPDATE ON notification_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_push_tokens_updated_at BEFORE UPDATE ON push_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### File Structure

New files to be created:

```
backend/src/
├── services/
│   ├── notificationQueueService.ts
│   ├── notificationService.ts
│   ├── notificationTrackingService.ts
│   ├── notificationConfigService.ts
│   ├── pushNotificationService.ts
│   ├── templateRenderer.ts
│   └── email/
│       ├── emailProviderFactory.ts
│       ├── emailProvider.interface.ts
│       ├── resendEmailProvider.ts
│       └── sendgridEmailProvider.ts
├── workers/
│   └── notificationWorker.ts
├── controllers/
│   └── notificationController.ts
├── routes/
│   └── notificationRoutes.ts
├── templates/
│   └── notifications/
│       ├── payment-notification.en.html
│       ├── payment-notification.en.txt
│       ├── payment-notification.es.html
│       └── payment-notification.es.txt
└── __tests__/
    ├── notificationService.test.ts
    ├── notificationService.property.test.ts
    ├── emailProviders.test.ts
    ├── templateRenderer.test.ts
    └── templateRenderer.property.test.ts
```

## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Payment Confirmation Triggers Notification Job

For any payment transaction that receives on-chain confirmation, the system shall enqueue exactly one notification job containing the transaction details.

**Validates: Requirements 2.1**

### Property 2: Notification Job Contains Complete Payment Data

For any notification job dequeued from the queue, the job data shall contain all required payment details (transaction ID, hash, employee ID, organization ID, amount, asset code, timestamp).

**Validates: Requirements 2.3**

### Property 3: Failed Jobs Retry with Exponential Backoff

For any notification job that fails, the system shall retry the job exactly 3 times with exponentially increasing delays before marking it as permanently failed.

**Validates: Requirements 2.4, 2.5, 8.2**

### Property 4: Final Failure Logging and Marking

For any notification job that exhausts all retry attempts, the system shall log the failure with details and mark the job status as failed in the database.

**Validates: Requirements 2.5, 8.3**

### Property 5: Email Template Completeness

For any rendered email notification, the HTML and plain text content shall include all required elements: employee first name, employee last name, payment amount with currency code, transaction hash as a clickable link, payment date/time in ISO 8601 format, and organization branding.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 6.1, 6.2**

### Property 6: Missing Contact Information Handling

For any employee without an email address or push notification token, the system shall skip the corresponding notification type, log a warning with the employee ID, and continue processing without failing the job.

**Validates: Requirements 3.7, 4.4, 8.5**

### Property 7: Push Notification Content Completeness

For any push notification sent to a registered device, the notification body shall include the payment amount with currency code, and the notification data shall include a deep link to the payment details.

**Validates: Requirements 4.2, 4.3**

### Property 8: Push Notification Delivery to All Registered Devices

For any employee with N registered push tokens (where N > 0), the system shall attempt to send push notifications to all N devices.

**Validates: Requirements 4.1**

### Property 9: Push Failure Isolation

For any push notification delivery failure, the system shall log the error but continue processing the notification job without marking it as failed (email delivery should still proceed).

**Validates: Requirements 4.5, 8.4**

### Property 10: Successful Delivery Tracking

For any successfully delivered notification (email or push), the system shall create a database record with status 'sent', the provider's message ID, and a timestamp.

**Validates: Requirements 5.1, 5.3**

### Property 11: Failed Delivery Tracking

For any failed notification delivery (email or push), the system shall create a database record with status 'failed', the error message, and a timestamp.

**Validates: Requirements 5.2, 5.4**

### Property 12: Notification-Transaction Association

For any notification record created in the database, the record shall be associated with the corresponding payment transaction ID.

**Validates: Requirements 5.5**

### Property 13: Notification History Query Completeness

For any employee ID and organization ID, querying the notification history shall return all notification records associated with that employee, ordered by creation timestamp descending.

**Validates: Requirements 5.6**

### Property 14: HTML Content Escaping

For any user-provided content (employee names, organization names) included in HTML email templates, all HTML special characters shall be escaped to prevent injection attacks.

**Validates: Requirements 6.3**

### Property 15: Currency Formatting Precision

For any payment amount rendered in an email or push notification, the currency shall be formatted with the appropriate decimal precision for that currency (e.g., 2 decimals for USD, 7 for XLM).

**Validates: Requirements 6.4**

### Property 16: Template Rendering Fallback

For any template rendering failure, the system shall log the error and generate a plain text notification containing the essential payment details (amount, currency, transaction hash).

**Validates: Requirements 6.5**

### Property 17: Organization Configuration Application

For any organization with custom notification configuration, the system shall apply that organization's settings (email enabled/disabled, push enabled/disabled, email provider, locale) when processing notifications for employees of that organization.

**Validates: Requirements 7.3, 7.4, 7.5**

### Property 18: Configuration Validation on Initialization

For any missing required configuration value (email provider type, API key, from address), the service initialization shall fail immediately with a descriptive error message indicating which configuration is missing.

**Validates: Requirements 1.6, 7.6**

### Property 19: Authentication Failure Logging

For any email provider API authentication failure, the system shall log an error message containing the provider name and error details (with sensitive data redacted).

**Validates: Requirements 1.5, 8.1**

### Property 20: Batch Processing Isolation

For any batch of N notification jobs, a failure in processing job i (where 1 ≤ i ≤ N) shall not prevent the processing of jobs i+1 through N.

**Validates: Requirements 8.4**

### Property 21: Locale-Based Template Selection

For any employee with a locale preference set, the system shall render the notification template in that locale's language, or fall back to English if the requested locale is not supported.

**Validates: Requirements 9.1, 9.2, 9.5**

### Property 22: Locale-Aware Formatting

For any employee with a locale preference, the system shall format currency amounts and date/time values according to that locale's conventions.

**Validates: Requirements 9.3, 9.4**

### Property 23: HTTPS Transmission

For any HTTP request sent to an email provider API, the request URL shall use the HTTPS protocol.

**Validates: Requirements 10.1**

### Property 24: Sensitive Data Redaction in Logs

For any log entry generated by the notification service, sensitive data (email addresses, payment amounts, API keys) shall be redacted or masked.

**Validates: Requirements 10.2, 10.3, 10.4**

### Property 25: Transaction Hash Validation

For any transaction hash included in a notification, the hash shall be validated to match the Stellar transaction hash format (64 hexadecimal characters) before being included in the notification content.

**Validates: Requirements 10.5**

### Property 26: Rate Limiting Enforcement

For any sequence of notification requests exceeding the configured rate limit threshold within the time window, the system shall delay or reject excess requests to prevent abuse.

**Validates: Requirements 10.6**

## Error Handling

### Error Categories

The notification service handles errors across multiple layers with appropriate recovery strategies:

#### 1. Configuration Errors (Fatal)

**Examples**:

- Missing required environment variables (EMAIL_PROVIDER, API keys)
- Invalid email provider type
- Malformed configuration values

**Handling**:

- Fail fast during service initialization
- Log descriptive error message with missing configuration details
- Prevent service startup to avoid runtime failures

**Recovery**: Requires configuration fix and service restart

#### 2. Queue Errors (Retriable)

**Examples**:

- Redis connection failure
- Queue full (max size exceeded)
- Job serialization errors

**Handling**:

- Retry queue operations with exponential backoff
- Log queue errors with context
- Alert monitoring system on persistent failures

**Recovery**: Automatic retry, manual intervention if Redis is down

#### 3. Database Errors (Retriable)

**Examples**:

- Connection pool exhausted
- Query timeout
- Constraint violations

**Handling**:

- Retry database operations (3 attempts)
- Use connection pooling with health checks
- Log errors with query context (sanitized)

**Recovery**: Automatic retry, connection pool recovery

#### 4. Email Provider API Errors (Retriable)

**Examples**:

- Rate limit exceeded (429)
- Temporary server error (5xx)
- Network timeout
- Authentication failure (401)

**Handling**:

- Retry with exponential backoff for 5xx and timeouts
- Do not retry for 4xx errors (except 429)
- Log provider response details
- Mark notification as failed after exhausting retries

**Recovery**: Automatic retry for transient errors, manual investigation for auth failures

#### 5. Validation Errors (Non-Retriable)

**Examples**:

- Invalid email address format
- Missing employee data
- Invalid transaction hash format

**Handling**:

- Skip notification delivery for that employee
- Log validation error with employee/transaction ID
- Mark notification as failed
- Continue processing other notifications

**Recovery**: Requires data correction, no automatic retry

#### 6. Template Rendering Errors (Recoverable)

**Examples**:

- Template file not found
- Template syntax error
- Missing template variables

**Handling**:

- Fall back to plain text template
- Log rendering error with template name
- Continue with simplified notification

**Recovery**: Automatic fallback to plain text

#### 7. Push Notification Errors (Isolated)

**Examples**:

- Invalid push token
- Push service unavailable
- Token expired

**Handling**:

- Log push error but do not fail the job
- Continue with email delivery
- Remove invalid tokens from database

**Recovery**: Email delivery proceeds, push tokens cleaned up

### Error Logging Strategy

All errors are logged with structured context:

```typescript
logger.error("Notification delivery failed", {
  errorType: "EMAIL_PROVIDER_ERROR",
  provider: "resend",
  employeeId: "[REDACTED]",
  transactionId: 12345,
  organizationId: 1,
  errorMessage: "Rate limit exceeded",
  retryAttempt: 2,
  maxRetries: 3,
});
```

**Sensitive Data Redaction**:

- Email addresses: Show only domain (e.g., `***@example.com`)
- Payment amounts: Redact completely or show only currency
- API keys: Never log
- Employee names: Log only IDs

### Monitoring and Alerting

**Metrics to Track**:

- Notification queue depth
- Job processing rate (jobs/minute)
- Success rate by notification type (email, push)
- Average delivery time
- Retry rate
- Failed job count

**Alert Conditions**:

- Queue depth > 1000 for > 5 minutes
- Success rate < 95% over 15 minutes
- Failed job count > 50 in 1 hour
- Email provider authentication failures
- Database connection failures

### Circuit Breaker Pattern

For email provider API calls, implement circuit breaker to prevent cascading failures:

**States**:

- **Closed**: Normal operation, requests flow through
- **Open**: Too many failures, requests fail immediately
- **Half-Open**: Testing if service recovered

**Thresholds**:

- Open circuit after 10 consecutive failures
- Keep circuit open for 60 seconds
- Allow 3 test requests in half-open state

## Testing Strategy

### Dual Testing Approach

The notification service requires both unit tests and property-based tests for comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and integration points
- **Property tests**: Verify universal properties across all inputs using randomized testing

Both approaches are complementary and necessary. Unit tests catch concrete bugs and validate specific scenarios, while property tests verify general correctness across a wide range of inputs.

### Property-Based Testing

**Library**: fast-check (already in package.json)

**Configuration**: Each property test runs minimum 100 iterations to ensure comprehensive input coverage.

**Test Tagging**: Each property test includes a comment referencing the design document property:

```typescript
// Feature: email-and-push-notification-service-for-payment, Property 5: Email Template Completeness
it("should include all required elements in rendered emails", () => {
  fc.assert(
    fc.property(
      paymentDataArbitrary,
      employeeArbitrary,
      organizationArbitrary,
      (paymentData, employee, organization) => {
        const rendered = templateRenderer.renderHtml("payment-notification", {
          employeeFirstName: employee.firstName,
          employeeLastName: employee.lastName,
          amount: paymentData.amount,
          currency: paymentData.currency,
          transactionHash: paymentData.hash,
          transactionUrl: `${STELLAR_EXPLORER_URL}/${paymentData.hash}`,
          paymentDate: paymentData.timestamp,
          organizationName: organization.name,
          locale: employee.locale || "en",
        });

        // Verify all required elements are present
        expect(rendered).toContain(employee.firstName);
        expect(rendered).toContain(employee.lastName);
        expect(rendered).toContain(paymentData.amount);
        expect(rendered).toContain(paymentData.currency);
        expect(rendered).toContain(paymentData.hash);
        expect(rendered).toContain(STELLAR_EXPLORER_URL);
        expect(rendered).toContain(organization.name);
      },
    ),
    { numRuns: 100 },
  );
});
```

### Property Test Coverage

Each correctness property maps to one or more property-based tests:

**Property 1-4**: Queue and retry behavior

- Generate random payment transactions
- Verify job enqueuing, dequeuing, and retry logic
- Test with simulated failures

**Property 5-7**: Template rendering and content

- Generate random employee data, payment amounts, currencies
- Verify all required fields present in output
- Test with various locales and special characters

**Property 8-9**: Push notification delivery

- Generate random employee records with varying numbers of push tokens
- Verify delivery attempts to all tokens
- Test failure isolation

**Property 10-13**: Notification tracking

- Generate random notification outcomes (success/failure)
- Verify database records created correctly
- Test query functionality with various filters

**Property 14-16**: Security and formatting

- Generate random strings with HTML special characters
- Verify proper escaping in output
- Test currency formatting with various amounts and currencies

**Property 17-22**: Configuration and localization

- Generate random organization configs and employee locales
- Verify correct configuration application
- Test locale fallback behavior

**Property 23-26**: Security and rate limiting

- Verify HTTPS usage in all API calls
- Test sensitive data redaction with various log scenarios
- Verify transaction hash validation
- Test rate limiting with burst traffic patterns

### Unit Test Coverage

Unit tests focus on specific scenarios and integration points:

**Configuration and Initialization**:

- Service initializes successfully with valid Resend config
- Service initializes successfully with valid SendGrid config
- Service fails initialization with missing API key
- Service fails initialization with invalid provider type

**Email Provider Integration**:

- Resend provider sends email successfully
- SendGrid provider sends email successfully
- Provider handles 429 rate limit response
- Provider handles 5xx server error
- Provider handles network timeout

**Queue Integration**:

- Job enqueued after successful payment
- Job contains correct payment data
- Worker processes job successfully
- Worker retries failed job
- Worker marks job as failed after max retries

**Template Rendering**:

- HTML template renders with valid data
- Plain text template renders with valid data
- Template falls back to plain text on rendering error
- Special characters are escaped in HTML
- Currency formatted correctly for USD
- Currency formatted correctly for XLM
- Date formatted in ISO 8601

**Notification Tracking**:

- Successful email delivery creates database record
- Failed email delivery creates database record
- Query returns notifications for employee
- Query filters by notification type
- Query filters by status

**Error Handling**:

- Missing email address skips email delivery
- Invalid email address skips email delivery
- Missing push token skips push delivery
- Push failure does not fail job
- Batch processing continues after individual failure

**Localization**:

- English template used by default
- Spanish template used when locale is 'es'
- Fallback to English for unsupported locale
- Currency formatted per locale
- Date formatted per locale

**Security**:

- Email addresses redacted in logs
- Payment amounts redacted in logs
- API keys never logged
- Invalid transaction hash rejected
- Rate limiting enforced

### Test Data Generators (Arbitraries)

For property-based testing, create custom arbitraries:

```typescript
// Employee arbitrary
const employeeArbitrary = fc.record({
  id: fc.integer({ min: 1, max: 100000 }),
  firstName: fc.string({ minLength: 1, maxLength: 50 }),
  lastName: fc.string({ minLength: 1, maxLength: 50 }),
  email: fc.emailAddress(),
  locale: fc.constantFrom("en", "es", "fr", "de", "pt"),
  organizationId: fc.integer({ min: 1, max: 1000 }),
});

// Payment data arbitrary
const paymentDataArbitrary = fc.record({
  amount: fc.double({ min: 0.01, max: 1000000, noNaN: true }),
  currency: fc.constantFrom("USDC", "XLM", "EURC", "ORGUSD"),
  hash: fc.hexaString({ minLength: 64, maxLength: 64 }),
  timestamp: fc.date().map((d) => d.toISOString()),
  transactionId: fc.integer({ min: 1, max: 1000000 }),
});

// Organization arbitrary
const organizationArbitrary = fc.record({
  id: fc.integer({ min: 1, max: 1000 }),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  emailEnabled: fc.boolean(),
  pushEnabled: fc.boolean(),
  emailProvider: fc.constantFrom("resend", "sendgrid"),
  locale: fc.constantFrom("en", "es", "fr"),
});

// Push token arbitrary
const pushTokenArbitrary = fc.record({
  token: fc.string({ minLength: 20, maxLength: 200 }),
  platform: fc.constantFrom("ios", "android", "web"),
});
```

### Integration Testing

**Queue Integration**:

- Test with real Redis instance
- Verify job persistence across worker restarts
- Test concurrent job processing

**Database Integration**:

- Test with real PostgreSQL instance
- Verify transaction isolation
- Test concurrent notification tracking

**Email Provider Integration** (with mocking):

- Mock Resend API responses
- Mock SendGrid API responses
- Test retry logic with simulated failures
- Verify request format and headers

### Performance Testing

**Load Testing**:

- Process 1000 notifications in < 5 minutes
- Queue depth remains stable under load
- Database connection pool does not exhaust

**Stress Testing**:

- Handle burst of 10,000 notifications
- Graceful degradation under extreme load
- Recovery after load subsides

### Test File Organization

```
backend/src/__tests__/
├── notificationService.test.ts              # Unit tests
├── notificationService.property.test.ts     # Property tests
├── notificationQueueService.test.ts         # Unit tests
├── notificationWorker.test.ts               # Unit tests
├── emailProviders.test.ts                   # Unit tests
├── templateRenderer.test.ts                 # Unit tests
├── templateRenderer.property.test.ts        # Property tests
├── notificationTracking.test.ts             # Unit tests
├── notificationTracking.property.test.ts    # Property tests
└── integration/
    ├── notificationFlow.integration.test.ts
    └── emailProviderIntegration.test.ts
```

### Continuous Integration

**Pre-commit**:

- Run unit tests
- Run linter
- Check TypeScript compilation

**CI Pipeline**:

- Run all unit tests
- Run all property tests (100 iterations each)
- Run integration tests
- Generate coverage report (target: >80%)
- Run security audit

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)

- Database migrations (notifications, notification_configs, push_tokens tables)
- Queue configuration extension
- NotificationQueueService implementation
- Basic NotificationWorker skeleton

### Phase 2: Email Provider Integration (Week 1-2)

- IEmailProvider interface
- EmailProviderFactory
- ResendEmailProvider implementation
- SendGridEmailProvider implementation
- Provider unit tests

### Phase 3: Template Rendering (Week 2)

- TemplateRenderer implementation
- HTML and plain text templates (English)
- Template rendering tests
- HTML escaping and security

### Phase 4: Core Notification Service (Week 2-3)

- NotificationService implementation
- NotificationTrackingService implementation
- NotificationConfigService implementation
- Integration with payroll worker
- Unit tests for core services

### Phase 5: Error Handling and Resilience (Week 3)

- Retry logic implementation
- Circuit breaker pattern
- Error logging and redaction
- Monitoring metrics

### Phase 6: Localization (Week 3-4)

- Multi-language template support
- Locale-aware formatting
- Fallback logic
- Localization tests

### Phase 7: Push Notifications (Week 4)

- PushNotificationService stub implementation
- Push token management
- Push notification API endpoints
- Push notification tests

### Phase 8: API Endpoints and Documentation (Week 4)

- NotificationController implementation
- API routes
- OpenAPI documentation
- API endpoint tests

### Phase 9: Property-Based Testing (Week 5)

- Create test data generators (arbitraries)
- Implement property tests for all 26 properties
- Achieve 100 iterations per property test
- Document property test results

### Phase 10: Integration and Performance Testing (Week 5)

- End-to-end integration tests
- Load testing
- Performance optimization
- Final documentation

## Security Considerations

### Data Protection

1. **Encryption in Transit**: All email provider API calls use HTTPS
2. **Sensitive Data Redaction**: Email addresses, payment amounts, and API keys are redacted in logs
3. **Input Validation**: All user-provided data is validated before use
4. **HTML Escaping**: User content is escaped to prevent XSS attacks
5. **SQL Injection Prevention**: Parameterized queries used throughout

### Access Control

1. **API Authentication**: All notification API endpoints require JWT authentication
2. **Authorization**: Employees can only view their own notification history
3. **Admin Access**: Organization admins can view all notifications for their organization
4. **Token Management**: Push tokens are scoped to individual employees

### Rate Limiting

1. **API Rate Limiting**: Notification API endpoints are rate-limited per user
2. **Provider Rate Limiting**: Respect email provider rate limits
3. **Queue Rate Limiting**: Prevent queue flooding with max queue size
4. **Abuse Prevention**: Monitor for unusual notification patterns

### Audit Trail

1. **Notification Tracking**: All notification attempts are logged in database
2. **Configuration Changes**: Log all changes to notification configs
3. **Error Logging**: Comprehensive error logging with context
4. **Monitoring**: Real-time monitoring of notification delivery rates

## Operational Considerations

### Deployment

1. **Environment Variables**: Ensure all required env vars are set before deployment
2. **Database Migration**: Run migration to create new tables
3. **Worker Startup**: Start notification worker alongside payroll worker
4. **Configuration Validation**: Service validates config on startup

### Monitoring

1. **Queue Metrics**: Monitor queue depth, processing rate, and job failures
2. **Delivery Metrics**: Track email and push notification success rates
3. **Provider Metrics**: Monitor email provider API response times and errors
4. **Database Metrics**: Track notification table growth and query performance

### Maintenance

1. **Log Rotation**: Configure log rotation for notification service logs
2. **Database Cleanup**: Periodically archive old notification records
3. **Token Cleanup**: Remove expired or invalid push tokens
4. **Template Updates**: Version control for email templates

### Disaster Recovery

1. **Queue Persistence**: Redis persistence ensures jobs survive restarts
2. **Database Backups**: Regular backups of notification data
3. **Retry Logic**: Failed notifications are automatically retried
4. **Manual Retry**: Admin interface to manually retry failed notifications

## Future Enhancements

### Short Term (3-6 months)

1. **SMS Notifications**: Add SMS provider integration (Twilio, AWS SNS)
2. **Webhook Notifications**: Allow organizations to receive webhook callbacks
3. **Notification Preferences**: Let employees customize notification preferences
4. **Rich Email Templates**: Enhanced HTML templates with charts and graphics

### Medium Term (6-12 months)

1. **Real-time Push**: Implement WebSocket-based real-time notifications
2. **Notification Scheduling**: Schedule notifications for specific times
3. **Batch Digests**: Daily/weekly digest emails for multiple payments
4. **A/B Testing**: Test different email templates and measure engagement

### Long Term (12+ months)

1. **Machine Learning**: Predict optimal notification timing per employee
2. **Multi-channel Orchestration**: Intelligent routing across email/push/SMS
3. **Advanced Analytics**: Notification engagement analytics dashboard
4. **White-label Templates**: Fully customizable templates per organization
