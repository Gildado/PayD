import { IEmailProvider } from './emailProvider.interface.js';
import { ResendEmailProvider } from './resendEmailProvider.js';
import { SendGridEmailProvider } from './sendgridEmailProvider.js';

export enum EmailProviderType {
  RESEND = 'resend',
  SENDGRID = 'sendgrid',
}

export interface EmailProviderConfig {
  type: EmailProviderType;
  apiKey: string;
  fromEmail: string;
}

export class EmailProviderFactory {
  static create(config: EmailProviderConfig): IEmailProvider {
    switch (config.type) {
      case EmailProviderType.RESEND:
        return new ResendEmailProvider(config.apiKey, config.fromEmail);
      case EmailProviderType.SENDGRID:
        return new SendGridEmailProvider(config.apiKey, config.fromEmail);
      default:
        throw new Error(
          `Unsupported email provider type: ${config.type}. Supported types: ${Object.values(EmailProviderType).join(', ')}`
        );
    }
  }

  static isValidProviderType(type: string): type is EmailProviderType {
    return Object.values(EmailProviderType).includes(type as EmailProviderType);
  }
}

import { config } from '../../config/env.js';

export function getEmailProvider(): IEmailProvider & {
  sendEmail(message: { to: string; from?: string; subject: string; html: string; text: string }): Promise<any>;
} {
  const providerType = config.EMAIL_PROVIDER as EmailProviderType;
  const apiKey =
    providerType === EmailProviderType.RESEND
      ? config.RESEND_API_KEY || 'dummy_key'
      : config.SENDGRID_API_KEY || 'dummy_key';
  const fromEmail = config.EMAIL_FROM_ADDRESS || 'noreply@payd.example.com';

  const provider = EmailProviderFactory.create({
    type: providerType,
    apiKey,
    fromEmail,
  });

  return {
    send: (message: any) => provider.send(message),
    validateConfig: () => provider.validateConfig(),
    sendEmail: (message: any) =>
      provider.send({
        to: message.to,
        from: message.from || fromEmail,
        subject: message.subject,
        html: message.html,
        text: message.text || '',
      }),
  };
}
