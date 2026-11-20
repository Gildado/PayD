import {
  DEFAULT_LOCALE,
  REPORT_MESSAGE_KEYS,
  SUPPORTED_LOCALES,
  formatDateForLocale,
  formatNumberForLocale,
  getLocalizedLabels,
  isSupportedLocale,
  localizeReport,
  translate,
} from '../reportI18nService.js';
import { FIXTURE_EXPECTED, REPORT_FIXTURE_TRANSACTIONS } from './fixtures/reportAgentFixture.js';

describe('ReportI18nService (#1339)', () => {
  it('supports en, es and fr with a complete translation table each', () => {
    expect(SUPPORTED_LOCALES).toEqual(['en', 'es', 'fr']);

    for (const locale of SUPPORTED_LOCALES) {
      const { labels } = getLocalizedLabels(locale);
      for (const key of REPORT_MESSAGE_KEYS) {
        expect(typeof labels[key]).toBe('string');
        expect(labels[key].length).toBeGreaterThan(0);
      }
    }
  });

  it('translates the report title per locale', () => {
    expect(translate('report.title', 'en')).toBe('Payroll Report');
    expect(translate('report.title', 'es')).toBe('Informe de Nómina');
    expect(translate('report.title', 'fr')).toBe('Rapport de Paie');
  });

  it('falls back to English for unknown locales and interpolates params', () => {
    // @ts-expect-error — runtime guard must fall back gracefully
    expect(translate('report.title', 'xx')).toBe('Payroll Report');

    const message = translate('report.rowCount', 'fr', { count: 42 });
    expect(message).toBe('42 lignes');
  });

  it('localizes the fixture report without mutating the payload', () => {
    const summary = {
      totalTransactions: FIXTURE_EXPECTED.totalTransactions,
      successfulTransactions: FIXTURE_EXPECTED.successfulTransactions,
      failedTransactions: FIXTURE_EXPECTED.failedTransactions,
      uniqueEmployees: FIXTURE_EXPECTED.uniqueEmployees,
    };
    const localized = localizeReport(summary, 'es');

    expect(localized.locale).toBe('es');
    expect(localized.data).toEqual(summary); // untouched
    expect(localized.labels['report.totalTransactions']).toBe(
      'Transacciones totales'
    );
  });

  it('formats dates and numbers per locale against known fixture values', () => {
    const newest = REPORT_FIXTURE_TRANSACTIONS[REPORT_FIXTURE_TRANSACTIONS.length - 1];

    expect(formatDateForLocale(newest.timestamp, 'en')).toBe(
      'March 1, 2024 at 3:00:00 PM'
    );
    expect(formatDateForLocale(newest.timestamp, 'es')).toContain('marzo de 2024');
    expect(formatDateForLocale(newest.timestamp, 'fr')).toContain('mars 2024');

    expect(formatNumberForLocale(FIXTURE_EXPECTED.totalTransactions, 'en')).toBe('6');
    expect(formatNumberForLocale(1234567.89, 'en')).toBe('1,234,567.89');
    expect(formatNumberForLocale(1234567.89, 'es')).toBe('1.234.567,89');
    expect(formatDateForLocale('not-a-date', 'en')).toBe('not-a-date');
  });

  it('guards locale parsing', () => {
    expect(isSupportedLocale('en')).toBe(true);
    expect(isSupportedLocale('de')).toBe(false);
    expect(DEFAULT_LOCALE).toBe('en');
  });
});
