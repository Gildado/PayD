import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type PageErrorFallbackProps = {
  error?: Error;
  resetError?: () => void;
  title?: string;
  description?: string;
  showRetry?: boolean;
};

export default function PageErrorFallback({
  title,
  description,
  resetError,
  showRetry = true,
}: PageErrorFallbackProps) {
  const { t } = useTranslation();

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[var(--accent)] focus:text-black focus:rounded-lg focus:font-medium"
      >
        Skip to main content
      </a>

      <header
        className="fixed top-0 left-0 right-0 z-50 h-(--header-h) items-center px-4 sm:px-8 lg:px-16 flex justify-between backdrop-blur-[20px] backdrop-saturate-180 border-b"
        style={{
          background: 'color-mix(in srgb, var(--bg) 85%, transparent)',
          borderColor: 'var(--border-hi)',
        }}
      >
        <a className="flex items-center gap-2.5" href="/" aria-label="PayD Home">
          <div className="w-8 h-8 rounded-lg grid place-items-center font-extrabold text-black text-sm tracking-tight shadow-[0_0_20px_rgba(74,240,184,0.3)] bg-linear-to-br from-(--accent) to-(--accent2)">
            P
          </div>
          <span className="text-lg font-extrabold tracking-tight">
            Pay<span className="text-(--accent)">D</span>
          </span>
          <span className="text-[9px] font-normal font-mono text-(--muted) tracking-widest uppercase border border-(--border-hi) px-1.5 py-0.5 rounded ml-0.5">
            BETA
          </span>
        </a>
      </header>

      <main id="main-content" className="flex flex-col flex-1 pt-(--header-h)">
        <div className="flex flex-col flex-1 px-6 py-8">
          <div className="flex-1 flex items-center justify-center">
            <div
              role="alert"
              aria-live="assertive"
              className="card glass noise max-w-lg w-full text-center p-12"
            >
              <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-[rgba(255,123,114,0.08)] border-2 border-[rgba(255,123,114,0.28)]">
                <AlertTriangle className="w-9 h-9 text-[var(--danger)]" aria-hidden="true" />
              </div>
              <h1 className="text-3xl font-bold mb-3 text-[var(--text)]">
                {title ?? t('errorFallback.pageErrorTitle')}
              </h1>
              <p className="text-[var(--muted)] text-base mb-8 leading-relaxed">
                {description ?? t('errorFallback.pageErrorDescription')}
              </p>
              <div className="flex items-center justify-center gap-4">
                {showRetry && resetError && (
                  <button
                    type="button"
                    onClick={resetError}
                    className="px-6 py-2.5 rounded-lg bg-[var(--accent)] text-black text-sm font-semibold hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:ring-offset-2 focus:ring-offset-[var(--bg)] transition-all active:scale-95"
                  >
                    {t('errorFallback.tryAgain')}
                  </button>
                )}
                <a
                  href="/"
                  className="px-6 py-2.5 rounded-lg border border-[var(--border-hi)] text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hi)] transition-colors inline-flex items-center focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
                >
                  {t('errorFallback.goHome')}
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer
        className="flex flex-wrap justify-between items-center gap-2 px-6 py-5 border-t text-xs font-mono text-(--muted)"
        style={{ borderColor: 'var(--border-hi)' }}
      >
        <span>
          &copy; {new Date().getFullYear()} PayD &mdash; Licensed under the{' '}
          <a
            href="http://www.apache.org/licenses/LICENSE-2.0"
            target="_blank"
            rel="noopener noreferrer"
            className="text-(--accent) hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 rounded"
          >
            Apache License 2.0
          </a>
        </span>
      </footer>
    </div>
  );
}
