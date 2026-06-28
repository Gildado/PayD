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
