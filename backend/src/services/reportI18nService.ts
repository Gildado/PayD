/**
 * Report agent localization (i18n) service (#1339).
 *
 * Localizes report agent output: translates well-known report labels and
 * message keys, and formats dates/numbers per locale using Intl.
 *
 * See docs/REPORT_AGENT.md for the documented localized output schema.
 */

export const SUPPORTED_LOCALES = ['en', 'es', 'fr'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'en';

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return (
    typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

/** Well-known message keys used across report agent output. */
export const REPORT_MESSAGE_KEYS = [
  'report.title',
  'report.generatedAt',
  'report.totalTransactions',
  'report.successfulTransactions',
  'report.failedTransactions',
  'report.uniqueEmployees',
  'report.rowCount',
  'report.status.fresh',
  'report.status.stale',
  'report.status.expired',
  'benchmark.title',
  'benchmark.duration',
  'failureAlert.title',
  'fallback.manualExport',
] as const;

export type ReportMessageKey = (typeof REPORT_MESSAGE_KEYS)[number];

type TranslationTable = Record<ReportMessageKey, string>;

const TRANSLATIONS: Record<SupportedLocale, TranslationTable> = {
  en: {
    'report.title': 'Payroll Report',
    'report.generatedAt': 'Generated at',
    'report.totalTransactions': 'Total transactions',
    'report.successfulTransactions': 'Successful transactions',
    'report.failedTransactions': 'Failed transactions',
    'report.uniqueEmployees': 'Unique employees',
    'report.rowCount': '{count} rows',
    'report.status.fresh': 'Fresh',
    'report.status.stale': 'Stale',
    'report.status.expired': 'No data',
    'benchmark.title': 'Performance Benchmark',
    'benchmark.duration': 'Duration',
    'failureAlert.title': 'Report generation failed',
    'fallback.manualExport': 'Manual export available',
  },
  es: {
    'report.title': 'Informe de Nómina',
    'report.generatedAt': 'Generado el',
    'report.totalTransactions': 'Transacciones totales',
    'report.successfulTransactions': 'Transacciones exitosas',
    'report.failedTransactions': 'Transacciones fallidas',
    'report.uniqueEmployees': 'Empleados únicos',
    'report.rowCount': '{count} filas',
    'report.status.fresh': 'Actualizado',
    'report.status.stale': 'Obsoleto',
    'report.status.expired': 'Sin datos',
    'benchmark.title': 'Prueba de Rendimiento',
    'benchmark.duration': 'Duración',
    'failureAlert.title': 'Falló la generación del informe',
    'fallback.manualExport': 'Exportación manual disponible',
  },
  fr: {
    'report.title': 'Rapport de Paie',
    'report.generatedAt': 'Généré le',
    'report.totalTransactions': 'Transactions totales',
    'report.successfulTransactions': 'Transactions réussies',
    'report.failedTransactions': 'Transactions échouées',
    'report.uniqueEmployees': 'Employés uniques',
    'report.rowCount': '{count} lignes',
    'report.status.fresh': 'À jour',
    'report.status.stale': 'Périmé',
    'report.status.expired': 'Aucune donnée',
    'benchmark.title': 'Test de Performance',
    'benchmark.duration': 'Durée',
    'failureAlert.title': 'Échec de la génération du rapport',
    'fallback.manualExport': 'Exportation manuelle disponible',
  },
};

/**
 * Minimal ICU-style interpolation: `{name}` placeholders replaced from
 * `params`. Unknown params are left untouched.
 */
export function translate(
  key: ReportMessageKey,
  locale: SupportedLocale = DEFAULT_LOCALE,
  params?: Record<string, string | number>
): string {
  const table = TRANSLATIONS[locale] ?? TRANSLATIONS[DEFAULT_LOCALE];
  let text = table[key] ?? TRANSLATIONS[DEFAULT_LOCALE][key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

export interface LocalizedLabels {
  locale: SupportedLocale;
  labels: Record<ReportMessageKey, string>;
}

/** Full label table for a locale — ready to ship to a UI. */
export function getLocalizedLabels(locale: SupportedLocale): LocalizedLabels {
  const labels = {} as Record<ReportMessageKey, string>;
  for (const key of REPORT_MESSAGE_KEYS) {
    labels[key] = translate(key, locale);
  }
  return { locale, labels };
}

export interface LocalizedValue<T> {
  /** Original structured payload, unchanged. */
  data: T;
  /** Locale applied to labels/formatting. */
  locale: SupportedLocale;
  /** Translated label table for rendering `data`. */
  labels: Record<ReportMessageKey, string>;
}

/**
 * Wraps any report payload with locale-aware labels without mutating the
 * structured payload itself, so downstream consumers keep a stable schema.
 */
export function localizeReport<T>(
  report: T,
  locale: SupportedLocale = DEFAULT_LOCALE
): LocalizedValue<T> {
  const { labels } = getLocalizedLabels(locale);
  return { data: report, locale, labels };
}

/** Locale-aware date/time formatting for report timestamps. */
export function formatDateForLocale(
  value: Date | string | number,
  locale: SupportedLocale = DEFAULT_LOCALE
): string {
  const date =
    value instanceof Date
      ? value
      : new Date(typeof value === 'number' ? value * 1000 : value);
  if (Number.isNaN(date.getTime())) return String(value);
  const tag = locale === 'en' ? 'en-US' : locale;
  return new Intl.DateTimeFormat(tag, {
    dateStyle: 'long',
    timeStyle: 'medium',
    timeZone: 'UTC',
  }).format(date);
}

/** Locale-aware number formatting for report metrics. */
export function formatNumberForLocale(
  value: number,
  locale: SupportedLocale = DEFAULT_LOCALE
): string {
  const tag = locale === 'en' ? 'en-US' : locale;
  return new Intl.NumberFormat(tag).format(value);
}
