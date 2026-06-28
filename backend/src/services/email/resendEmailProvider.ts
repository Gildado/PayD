import {
  IEmailProvider,
  EmailMessage,
  EmailSendResult,
} from './emailProvider.interface.js';
import logger from '../../utils/logger.js';

export class ResendEmailProvider implements IEmailProvider {
  private apiKey: string;
  private fromEmail: string;
  private apiUrl = 'https://api.resend.com/emails';

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
          from: message.from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.message || `HTTP ${response.status}: ${response.statusText}`;

        logger.error('Resend email send failed', {
          provider: 'resend',
          status: response.status,
          error: errorMessage,
          to: this.redactEmail(message.to),
        });

        return {
          success: false,
          error: errorMessage,
        };
      }

      const data = await response.json();
      logger.info('Email sent successfully via Resend', {
        provider: 'resend',
        messageId: data.id,
        to: this.redactEmail(message.to),
      });

      return {
        success: true,
        messageId: data.id,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      logger.error('Resend email send error', {
        provider: 'resend',
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
          from: this.fromEmail,
          to: ['test@example.com'],
          subject: 'Config validation',
          html: '<p>Test</p>',
        }),
      });

      // We expect this to fail with validation error, but not auth error
      if (response.status === 401 || response.status === 403) {
        logger.error('Resend authentication failed', {
          provider: 'resend',
          status: response.status,
        });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Resend config validation error', {
        provider: 'resend',
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
