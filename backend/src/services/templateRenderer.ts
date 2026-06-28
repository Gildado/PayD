import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface TemplateData {
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

export class TemplateRenderer {
  private templatesDir: string;

  constructor(templatesDir?: string) {
    this.templatesDir =
      templatesDir || path.join(__dirname, '..', 'templates', 'notifications');
  }

  renderHtml(templateName: string, data: TemplateData): string {
    try {
      const template = this.loadTemplate(templateName, 'html', data.locale);
      return this.render(template, data);
    } catch (error) {
      logger.error('HTML template rendering failed, falling back to plain text', {
        templateName,
        locale: data.locale,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return this.renderFallbackHtml(data);
    }
  }

  renderText(templateName: string, data: TemplateData): string {
    try {
      const template = this.loadTemplate(templateName, 'txt', data.locale);
      return this.render(template, data);
    } catch (error) {
      logger.error('Text template rendering failed, using fallback', {
        templateName,
        locale: data.locale,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return this.renderFallbackText(data);
    }
  }

  private loadTemplate(
    templateName: string,
    extension: 'html' | 'txt',
    locale: string
  ): string {
    // Try locale-specific template first
    const localeTemplatePath = path.join(
      this.templatesDir,
      `${templateName}.${locale}.${extension}`
    );

    if (fs.existsSync(localeTemplatePath)) {
      return fs.readFileSync(localeTemplatePath, 'utf-8');
    }

    // Fall back to English
    const defaultTemplatePath = path.join(
      this.templatesDir,
      `${templateName}.en.${extension}`
    );

    if (fs.existsSync(defaultTemplatePath)) {
      logger.info('Falling back to English template', {
        templateName,
        requestedLocale: locale,
        extension,
      });
      return fs.readFileSync(defaultTemplatePath, 'utf-8');
    }

    throw new Error(
      `Template not found: ${templateName}.${locale}.${extension} or ${templateName}.en.${extension}`
    );
  }

  private render(template: string, data: TemplateData): string {
    let rendered = template;

    // Replace all template variables
    rendered = rendered.replace(/\{\{employeeFirstName\}\}/g, this.escapeHtml(data.employeeFirstName));
    rendered = rendered.replace(/\{\{employeeLastName\}\}/g, this.escapeHtml(data.employeeLastName));
    rendered = rendered.replace(/\{\{amount\}\}/g, this.formatCurrency(data.amount, data.currency, data.locale));
    rendered = rendered.replace(/\{\{currency\}\}/g, this.escapeHtml(data.currency));
    rendered = rendered.replace(/\{\{transactionHash\}\}/g, this.escapeHtml(data.transactionHash));
    rendered = rendered.replace(/\{\{transactionUrl\}\}/g, this.escapeHtml(data.transactionUrl));
    rendered = rendered.replace(/\{\{paymentDate\}\}/g, this.formatDate(data.paymentDate, data.locale));
    rendered = rendered.replace(/\{\{organizationName\}\}/g, this.escapeHtml(data.organizationName));

    return rendered;
  }

  private escapeHtml(text: string): string {
    const htmlEscapeMap: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '/': '&#x2F;',
    };

    return text.replace(/[&<>"'/]/g, (char) => htmlEscapeMap[char] || char);
  }

  private formatCurrency(
    amount: string,
    currency: string,
    locale: string
  ): string {
    try {
      const numericAmount = parseFloat(amount);
      
      // Determine decimal places based on currency
      let decimals = 2; // Default for most currencies
      if (currency === 'XLM') {
        decimals = 7;
      } else if (['BTC', 'ETH'].includes(currency)) {
        decimals = 8;
      }

      // Format using Intl.NumberFormat
      const formatter = new Intl.NumberFormat(locale, {
        style: 'decimal',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });

      return `${formatter.format(numericAmount)} ${currency}`;
    } catch (error) {
      logger.error('Currency formatting error', {
        amount,
        currency,
        locale,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return `${amount} ${currency}`;
    }
  }

  private formatDate(dateString: string, locale: string): string {
    try {
      const date = new Date(dateString);
      
      const formatter = new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      });

      return formatter.format(date);
    } catch (error) {
      logger.error('Date formatting error', {
        dateString,
        locale,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return dateString;
    }
  }

  private renderFallbackHtml(data: TemplateData): string {
    const escapedData = {
      employeeFirstName: this.escapeHtml(data.employeeFirstName),
      employeeLastName: this.escapeHtml(data.employeeLastName),
      amount: this.formatCurrency(data.amount, data.currency, data.locale),
      transactionHash: this.escapeHtml(data.transactionHash),
      transactionUrl: this.escapeHtml(data.transactionUrl),
      paymentDate: this.formatDate(data.paymentDate, data.locale),
      organizationName: this.escapeHtml(data.organizationName),
    };

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Payment Received</title>
</head>
<body>
  <h1>Payment Received</h1>
  <p>Dear ${escapedData.employeeFirstName} ${escapedData.employeeLastName},</p>
  <p>You have received a payment of <strong>${escapedData.amount}</strong>.</p>
  <p><strong>Transaction Details:</strong></p>
  <ul>
    <li>Amount: ${escapedData.amount}</li>
    <li>Date: ${escapedData.paymentDate}</li>
    <li>Transaction Hash: <a href="${escapedData.transactionUrl}">${escapedData.transactionHash}</a></li>
  </ul>
  <p>Best regards,<br>${escapedData.organizationName}</p>
</body>
</html>
    `.trim();
  }

  private renderFallbackText(data: TemplateData): string {
    const amount = this.formatCurrency(data.amount, data.currency, data.locale);
    const paymentDate = this.formatDate(data.paymentDate, data.locale);

    return `
Payment Received

Dear ${data.employeeFirstName} ${data.employeeLastName},

You have received a payment of ${amount}.

Transaction Details:
- Amount: ${amount}
- Date: ${paymentDate}
- Transaction Hash: ${data.transactionHash}
- View on blockchain: ${data.transactionUrl}

Best regards,
${data.organizationName}
    `.trim();
  }
}
