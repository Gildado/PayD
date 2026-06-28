import {
  IEmailProvider,
  EmailMessage,
  EmailSendResult,
} from './emailProvider.interface.js';
import logger from '../../utils/logger.js';

export class SendGridEmailProvider implements IEmailProvider {
  private apiKey: string;
  private fromEmail: string;
  private apiUrl = 'https://api.sendgrid.com/v3/mail/send';

  constructor(apiKey: string, fromEmail: string) {
    this.apiKey = apiKey;
    this.fromEmail = fromEmail;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [{ email: message.to }],
            },
          ],
          from: {
            email: message.from,
          },
          subject: message.subject,
          content: [
            {
              type: 'text/plain',
              value: message.text,
            },
            {
              type: 'text/html',
              value: message.html,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.errors?.[0]?.message ||
          `HTTP ${response.status}: ${response.statusText}`;

        logger.error('SendGrid email send failed', {
          provider: 'sendgrid',
          status: response.status,
          error: errorMessage,
          to: this.redactEmail(message.to),
        });

        return {
          success: false,
          error: errorMessage,
        };
      }

      // SendGrid returns 202 with empty body, message ID in header
      const messageId = response.headers.get('X-Message-Id') || undefined;

      logger.info('Email sent successfully via SendGrid', {
        provider: 'sendgrid',
        messageId,
        to: this.redactEmail(message.to),
      });

      return {
        success: true,
        messageId,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      logger.error('SendGrid email send error', {
        provider: 'sendgrid',
        error: errorMessage,
        to: this.redactEmail(message.to),
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async validateConfig(): Promise<boolean> {
    try {
      // Test API key by making a simple request
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [{ email: 'test@example.com' }],
            },
          ],
          from: {
            email: this.fromEmail,
          },
          subject: 'Config validation',
          content: [
            {
              type: 'text/plain',
              value: 'Test',
            },
          ],
        }),
      });

      // We expect this to fail with validation error, but not auth error
      if (response.status === 401 || response.status === 403) {
        logger.error('SendGrid authentication failed', {
          provider: 'sendgrid',
          status: response.status,
        });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('SendGrid config validation error', {
        provider: 'sendgrid',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  private redactEmail(email: string): string {
    const [, domain] = email.split('@');
    return `***@${domain || '***'}`;
  }
}
