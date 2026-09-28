# Implementation Plan: Email and Push Notification Service for Payment

## Overview

This implementation plan breaks down the notification service into actionable coding tasks following the 10-phase approach outlined in the design document. The service will send email and push notifications to employees after payment confirmation, using a queue-based architecture integrated with the existing PayD infrastructure.

## Tasks

- [x] 1. Set up database schema and migrations
  - Create migration file for notifications, notification_configs, and push_tokens tables
  - Add locale column to employees table
  - Create indexes for query optimization
  - Add triggers for updated_at columns
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 7.3, 7.4, 7.5, 9.1_

- [ ]\* 1.1 Write property test for database schema
  - **Property 12: Notification-Transaction Association**
  - **Validates: Requirements 5.5**

- [x] 2. Extend queue configuration
  - Add NOTIFICATION_QUEUE_NAME constant to backend/src/config/queue.ts
  - Add notificationQueueConfig with retry and backoff settings
  - Configure job retention policies
  - _Requirements: 2.1, 2.2, 2.4, 2.5_

- [ ] 3. Implement email provider infrastructure
  - [x] 3.1 Create IEmailProvider interface
    - Define EmailMessage, EmailSendResult, and IEmailProvider types
    - _Requirements: 1.1, 1.2_
  - [x] 3.2 Implement ResendEmailProvider
    - Implement send method with Resend API integration
    - Implement validateConfig method
    - Add HTTPS transmission and error handling
    - _Requirements: 1.1, 1.3, 10.1_
  - [x] 3.3 Implement SendGridEmailProvider
    - Implement send method with SendGrid API integration
    - Implement validateConfig method
    - Add HTTPS transmission and error handling
    - _Requirements: 1.2, 1.4, 10.1_
  - [x] 3.4 Create EmailProviderFactory
    - Implement factory pattern to create provider instances
    - Add provider type validation
    - _Requirements: 1.1, 1.2, 7.1_

- [ ]\* 3.5 Write unit tests for email providers
  - Test Resend provider send and validation
  - Test SendGrid provider send and validation
  - Test factory creation logic
  - Mock API responses for both providers
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ]\* 3.6 Write property test for email provider error handling
  - **Property 19: Authentication Failure Logging**
  - **Validates: Requirements 1.5, 8.1**

- [ ] 4. Implement template rendering system
  - [x] 4.1 Create TemplateRenderer class
    - Implement renderHtml and renderText methods
    - Implement escapeHtml for XSS prevention
    - Implement formatCurrency with locale support
    - Implement formatDate with locale support
    - Add fallback logic for rendering errors
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 9.3, 9.4_
  - [x] 4.2 Create email templates
    - Create payment-notification.en.html template
    - Create payment-notification.en.txt template
    - Include all required elements per design
    - Add organization branding placeholders
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ]\* 4.3 Write unit tests for template renderer
  - Test HTML rendering with valid data
  - Test plain text rendering
  - Test HTML escaping
  - Test currency formatting for different currencies
  - Test date formatting
  - Test fallback on rendering error
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ]\* 4.4 Write property test for template completeness
  - **Property 5: Email Template Completeness**
  - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 6.1, 6.2**

- [ ]\* 4.5 Write property test for HTML escaping
  - **Property 14: HTML Content Escaping**
  - **Validates: Requirements 6.3**

- [ ]\* 4.6 Write property test for currency formatting
  - **Property 15: Currency Formatting Precision**
  - **Validates: Requirements 6.4**

- [ ] 5. Implement notification configuration service
  - [x] 5.1 Create NotificationConfigService class
    - Implement getConfig method to retrieve organization settings
    - Implement updateConfig method for admin updates
    - Add configuration validation
    - Add default configuration fallback
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [ ]\* 5.2 Write unit tests for configuration service
  - Test getConfig retrieves correct settings
  - Test updateConfig persists changes
  - Test default configuration fallback
  - Test validation of configuration values
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [ ]\* 5.3 Write property test for configuration application
  - **Property 17: Organization Configuration Application**
  - **Validates: Requirements 7.3, 7.4, 7.5**

- [ ]\* 5.4 Write property test for configuration validation
  - **Property 18: Configuration Validation on Initialization**
  - **Validates: Requirements 1.6, 7.6**

- [ ] 6. Implement notification tracking service
  - [x] 6.1 Create NotificationTrackingService class
    - Implement recordEmailSent method
    - Implement recordEmailFailed method
    - Implement recordPushSent method
    - Implement recordPushFailed method
    - Implement getNotificationHistory with pagination
    - Implement getNotificationByTransaction method
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [ ]\* 6.2 Write unit tests for tracking service
  - Test recording successful email delivery
  - Test recording failed email delivery
  - Test recording push notifications
  - Test notification history queries
  - Test transaction-based queries
  - Test pagination
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [ ]\* 6.3 Write property test for delivery tracking
  - **Property 10: Successful Delivery Tracking**
  - **Property 11: Failed Delivery Tracking**
  - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**

- [ ]\* 6.4 Write property test for notification history
  - **Property 13: Notification History Query Completeness**
  - **Validates: Requirements 5.6**

- [ ] 7. Implement push notification service (stub)
  - [x] 7.1 Create PushNotificationService class
    - Implement send method (stub that logs and returns success)
    - Implement registerToken method
    - Implement removeToken method
    - Add database operations for push_tokens table
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ]\* 7.2 Write unit tests for push notification service
  - Test token registration
  - Test token removal
  - Test send method stub
  - _Requirements: 4.1, 4.4_

- [ ] 8. Checkpoint - Verify core services
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement core notification service
  - [x] 9.1 Create NotificationService class
    - Implement sendPaymentNotification orchestration method
    - Implement private sendEmail method
    - Implement private sendPush method
    - Integrate with EmailProviderFactory
    - Integrate with TemplateRenderer
    - Integrate with NotificationConfigService
    - Integrate with NotificationTrackingService
    - Add error handling for missing employee data
    - Add logging with sensitive data redaction
    - _Requirements: 2.3, 3.7, 4.4, 4.5, 8.1, 8.4, 8.5, 10.2, 10.3, 10.4_

- [ ]\* 9.2 Write unit tests for notification service
  - Test successful email and push delivery
  - Test email-only delivery (no push tokens)
  - Test push-only delivery (no email)
  - Test missing employee email handling
  - Test missing push token handling
  - Test push failure isolation
  - Test error logging and redaction
  - _Requirements: 3.7, 4.4, 4.5, 8.4, 8.5_

- [ ]\* 9.3 Write property test for missing contact info
  - **Property 6: Missing Contact Information Handling**
  - **Validates: Requirements 3.7, 4.4, 8.5**

- [ ]\* 9.4 Write property test for push failure isolation
  - **Property 9: Push Failure Isolation**
  - **Validates: Requirements 4.5, 8.4**

- [ ] 10. Implement notification queue service
  - [x] 10.1 Create NotificationQueueService class
    - Implement enqueuePaymentNotification method
    - Implement getJobStatus method
    - Add queue connection and error handling
    - _Requirements: 2.1, 2.2_

- [ ]\* 10.2 Write unit tests for queue service
  - Test job enqueuing with valid data
  - Test job status retrieval
  - Test queue error handling
  - _Requirements: 2.1, 2.2_

- [ ]\* 10.3 Write property test for notification job data
  - **Property 2: Notification Job Contains Complete Payment Data**
  - **Validates: Requirements 2.3**

- [ ] 11. Implement notification worker
  - [x] 11.1 Create NotificationWorker class
    - Implement processJob method
    - Add retry logic with exponential backoff (3 attempts)
    - Add error handling and logging
    - Integrate with NotificationService
    - Integrate with NotificationTrackingService
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 8.2, 8.3_
  - [x] 11.2 Register notification worker in backend/src/workers/index.ts
    - Import and initialize notification worker
    - Add to startWorkers and stopWorkers functions
    - _Requirements: 2.2_

- [ ]\* 11.3 Write unit tests for notification worker
  - Test successful job processing
  - Test retry logic on failure
  - Test job marked as failed after max retries
  - Test error logging
  - _Requirements: 2.2, 2.3, 2.4, 2.5_

- [ ]\* 11.4 Write property test for retry behavior
  - **Property 3: Failed Jobs Retry with Exponential Backoff**
  - **Property 4: Final Failure Logging and Marking**
  - **Validates: Requirements 2.4, 2.5, 8.2, 8.3**

- [ ] 12. Integrate with payroll worker
  - [x] 12.1 Modify backend/src/workers/payrollWorker.ts
    - Import NotificationQueueService
    - Add enqueuePaymentNotification call after successful transaction
    - Add error handling for notification enqueuing
    - _Requirements: 2.1_

- [ ]\* 12.2 Write property test for payment confirmation trigger
  - **Property 1: Payment Confirmation Triggers Notification Job**
  - **Validates: Requirements 2.1**

- [ ] 13. Checkpoint - Verify queue and worker integration
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Implement localization support
  - [ ] 14.1 Create additional language templates
    - Create payment-notification.es.html and .txt (Spanish)
    - Create payment-notification.fr.html and .txt (French)
    - _Requirements: 9.1, 9.2_
  - [ ] 14.2 Enhance TemplateRenderer for locale selection
    - Add locale-based template selection logic
    - Add fallback to English for unsupported locales
    - Update formatCurrency for locale-aware formatting
    - Update formatDate for locale-aware formatting
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ]\* 14.3 Write unit tests for localization
  - Test English template selection
  - Test Spanish template selection
  - Test fallback to English for unsupported locale
  - Test locale-aware currency formatting
  - Test locale-aware date formatting
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ]\* 14.4 Write property test for locale-based template selection
  - **Property 21: Locale-Based Template Selection**
  - **Validates: Requirements 9.1, 9.2, 9.5**

- [ ]\* 14.5 Write property test for locale-aware formatting
  - **Property 22: Locale-Aware Formatting**
  - **Validates: Requirements 9.3, 9.4**

- [ ] 15. Implement security and validation
  - [ ] 15.1 Add transaction hash validation
    - Create validation function for Stellar transaction hash format (64 hex chars)
    - Integrate validation into NotificationService
    - _Requirements: 10.5_
  - [ ] 15.2 Implement sensitive data redaction
    - Create redaction utility functions
    - Apply redaction to all log statements
    - Redact email addresses, payment amounts, API keys
    - _Requirements: 10.2, 10.3, 10.4_
  - [ ] 15.3 Add rate limiting
    - Implement rate limiting for notification sending
    - Add rate limit configuration
    - _Requirements: 10.6_

- [ ]\* 15.4 Write unit tests for security features
  - Test transaction hash validation (valid and invalid)
  - Test sensitive data redaction in logs
  - Test rate limiting enforcement
  - _Requirements: 10.2, 10.3, 10.4, 10.5, 10.6_

- [ ]\* 15.5 Write property test for HTTPS transmission
  - **Property 23: HTTPS Transmission**
  - **Validates: Requirements 10.1**

- [ ]\* 15.6 Write property test for sensitive data redaction
  - **Property 24: Sensitive Data Redaction in Logs**
  - **Validates: Requirements 10.2, 10.3, 10.4**

- [ ]\* 15.7 Write property test for transaction hash validation
  - **Property 25: Transaction Hash Validation**
  - **Validates: Requirements 10.5**

- [ ]\* 15.8 Write property test for rate limiting
  - **Property 26: Rate Limiting Enforcement**
  - **Validates: Requirements 10.6**

- [ ] 16. Implement HTTP API endpoints
  - [x] 16.1 Create NotificationController
    - Implement getNotificationHistory handler
    - Implement getNotificationConfig handler
    - Implement updateNotificationConfig handler
    - Implement registerPushToken handler
    - Implement removePushToken handler
    - Add authentication and authorization checks
    - Add input validation
    - _Requirements: 5.6, 7.3, 7.4, 7.5_
  - [x] 16.2 Create notification routes
    - Create backend/src/routes/notificationRoutes.ts
    - Define GET /api/notifications/history route
    - Define GET /api/notifications/config route
    - Define PUT /api/notifications/config route
    - Define POST /api/notifications/push-token route
    - Define DELETE /api/notifications/push-token route
    - Add authentication middleware
    - _Requirements: 5.6, 7.3, 7.4, 7.5_
  - [x] 16.3 Register notification routes in main app
    - Import and mount notification routes in backend/src/app.ts or server.ts
    - _Requirements: 5.6_

- [ ]\* 16.4 Write unit tests for API endpoints
  - Test notification history endpoint with various filters
  - Test config get and update endpoints
  - Test push token registration and removal
  - Test authentication and authorization
  - Test input validation
  - _Requirements: 5.6, 7.3, 7.4, 7.5_

- [ ] 17. Checkpoint - Verify API and security implementation
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 18. Implement error handling and resilience
  - [ ] 18.1 Add retry logic with exponential backoff
    - Implement retry wrapper for email provider calls
    - Configure exponential backoff (3 attempts, 5s initial delay)
    - _Requirements: 2.4, 8.2_
  - [ ] 18.2 Add circuit breaker pattern
    - Implement circuit breaker for email provider API calls
    - Configure thresholds (10 failures, 60s timeout)
    - _Requirements: 8.2, 8.3_
  - [ ] 18.3 Enhance error logging
    - Add structured error logging with context
    - Apply sensitive data redaction to all error logs
    - Add error categorization
    - _Requirements: 1.5, 8.1, 8.3, 10.2, 10.3, 10.4_

- [ ]\* 18.4 Write unit tests for error handling
  - Test retry logic with simulated failures
  - Test circuit breaker state transitions
  - Test error logging with redaction
  - _Requirements: 8.1, 8.2, 8.3_

- [ ]\* 18.5 Write property test for batch processing isolation
  - **Property 20: Batch Processing Isolation**
  - **Validates: Requirements 8.4**

- [ ] 19. Add environment configuration
  - [x] 19.1 Update .env.example
    - Add EMAIL_PROVIDER variable
    - Add RESEND_API_KEY and SENDGRID_API_KEY variables
    - Add EMAIL_FROM_ADDRESS and EMAIL_FROM_NAME variables
    - Add NOTIFICATION_QUEUE_NAME and retry configuration
    - Add STELLAR_EXPLORER_URL variable
    - _Requirements: 7.1, 7.2_
  - [x] 19.2 Add configuration validation on service initialization
    - Validate required environment variables are present
    - Validate email provider type is valid
    - Fail fast with descriptive error if config missing
    - _Requirements: 1.6, 7.6_

- [ ]\* 19.3 Write unit tests for configuration validation
  - Test service initialization with valid config
  - Test service fails with missing API key
  - Test service fails with invalid provider type
  - Test descriptive error messages
  - _Requirements: 1.6, 7.6_

- [ ] 20. Implement push notification delivery
  - [ ] 20.1 Enhance PushNotificationService
    - Implement send method to deliver to all registered tokens
    - Add error handling for invalid tokens
    - Add token cleanup for expired tokens
    - Add logging for push delivery
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ]\* 20.2 Write unit tests for push notification delivery
  - Test delivery to single token
  - Test delivery to multiple tokens
  - Test handling of invalid tokens
  - Test error isolation
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ]\* 20.3 Write property test for push delivery to all devices
  - **Property 8: Push Notification Delivery to All Registered Devices**
  - **Validates: Requirements 4.1**

- [ ]\* 20.4 Write property test for push content completeness
  - **Property 7: Push Notification Content Completeness**
  - **Validates: Requirements 4.2, 4.3**

- [ ] 21. Add localization templates for additional languages
  - Create templates for Spanish (es)
  - Create templates for French (fr)
  - Test template rendering for each locale
  - _Requirements: 9.1, 9.2_

- [ ] 22. Implement monitoring and observability
  - [ ] 22.1 Add metrics collection
    - Add queue depth metric
    - Add job processing rate metric
    - Add success rate metrics by notification type
    - Add delivery time metrics
    - Add retry rate metric
    - Add failed job count metric
  - [ ] 22.2 Add structured logging
    - Log notification job enqueued
    - Log notification job processing started
    - Log notification delivery success/failure
    - Log retry attempts
    - All logs include transaction ID and organization ID for traceability

- [ ] 23. Integration testing
  - [ ]\* 23.1 Write end-to-end integration test
    - Test complete flow from payment confirmation to notification delivery
    - Test with real Redis queue
    - Test with real PostgreSQL database
    - Mock email provider APIs
    - Verify notification tracking records created
    - _Requirements: 2.1, 2.2, 2.3, 5.1, 5.5_
  - [ ]\* 23.2 Write email provider integration tests
    - Test Resend provider with mocked API
    - Test SendGrid provider with mocked API
    - Test error handling for various API responses
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 24. Final checkpoint and documentation
  - Ensure all tests pass
  - Verify all environment variables documented
  - Verify database migrations are idempotent
  - Ask the user if questions arise before deployment

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The implementation uses TypeScript throughout
- Integration with existing Bull queue infrastructure (backend/src/config/queue.ts)
- Integration with existing payroll worker (backend/src/workers/payrollWorker.ts)
- Database migrations should be run before deploying the service
- Email provider API keys must be configured in environment variables
- Property tests validate universal correctness properties across randomized inputs
- Unit tests validate specific examples, edge cases, and integration points
