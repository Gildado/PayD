export interface EmailMessage {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface IEmailProvider {
  send(message: EmailMessage): Promise<EmailSendResult>;
  validateConfig(): Promise<boolean>;
}
