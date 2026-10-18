import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StandardIcon } from './common/Icon';
import { Button, ArrowLink } from './common/Button';

export const COOKIE_CONSENT_KEY = 'payd_cookie_consent_v1';

export type CookieConsentType = 'all' | 'necessary' | 'dismissed';

export interface CookieConsentBannerProps {
  className?: string;
  forceVisible?: boolean; // For testing or preview
  onConsentChange?: (consent: CookieConsentType) => void;
}

export const CookieConsentBanner: React.FC<CookieConsentBannerProps> = ({
  className = '',
  forceVisible = false,
  onConsentChange,
}) => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (forceVisible) {
      setIsVisible(true);
      return;
    }

    try {
      const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
      if (!stored) {
        // Small delay so entrance feels smooth and non-blocking
        const timer = setTimeout(() => setIsVisible(true), 350);
        return () => clearTimeout(timer);
      }
    } catch {
      // LocalStorage access restricted / incognito fallback
      setIsVisible(true);
    }
  }, [forceVisible]);

  const saveConsent = (type: CookieConsentType) => {
    try {
      localStorage.setItem(
        COOKIE_CONSENT_KEY,
        JSON.stringify({
          consent: type,
          timestamp: new Date().toISOString(),
          version: '1.0',
        })
      );
    } catch {
      // Ignore localStorage failure in restricted contexts
    }
    setIsVisible(false);
    onConsentChange?.(type);
  };

  if (!isVisible) return null;

  return (
    <aside
      className={`fixed bottom-4 inset-x-4 sm:bottom-6 sm:inset-x-6 z-50 mx-auto max-w-4xl motion-route-in ${className}`}
      role="region"
      aria-label={t('cookieConsent.ariaLabel', 'Cookie and regulatory compliance disclosure')}
    >
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-border-hi bg-[color-mix(in_srgb,var(--surface)_96%,transparent)] p-5 sm:p-6 shadow-2xl backdrop-blur-xl">
        {/* Subtle accent border top bar */}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-accent via-accent2 to-accent3" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 sm:gap-6">
          {/* Content & Icon */}
          <div className="flex items-start gap-4 flex-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-accent2/30 bg-accent2/10 text-accent2">
              <StandardIcon.Cookie size="md" />
            </div>

            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-text">
                  {t('cookieConsent.title', 'Regulatory & Cookie Disclosure')}
                </h3>
                <span className="rounded-full border border-border bg-surface-hi px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                  {t('cookieConsent.mainnetReady', 'Mainnet Ready')}
                </span>
              </div>

              <p className="text-xs sm:text-sm text-muted leading-relaxed">
                {t(
                  'cookieConsent.description',
                  'PayD uses essential cookies and cryptographic session parameters to process real-time Stellar payroll and verify transaction proofs. We do not sell your personal data.'
                )}
              </p>

              <div className="pt-1 flex items-center gap-4 flex-wrap">
                <ArrowLink to="/privacy" className="!p-0 !min-h-0 text-xs">
                  {t('cookieConsent.privacyPolicy', 'Privacy Policy & Terms')}
                </ArrowLink>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-3 w-full sm:w-auto self-end md:self-center shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => saveConsent('necessary')}
              className="flex-1 sm:flex-initial text-xs"
              aria-label={t('cookieConsent.acceptNecessary', 'Accept necessary cookies only')}
            >
              {t('cookieConsent.necessaryOnly', 'Necessary Only')}
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => saveConsent('all')}
              className="flex-1 sm:flex-initial text-xs"
              aria-label={t('cookieConsent.acceptAll', 'Accept all cookies')}
            >
              {t('cookieConsent.acceptAll', 'Accept All')}
            </Button>

            <button
              type="button"
              onClick={() => saveConsent('dismissed')}
              className="text-muted hover:text-text p-1.5 rounded-full hover:bg-surface-hi transition-colors focus-visible:outline-2 focus-visible:outline-accent"
              aria-label={t('cookieConsent.dismiss', 'Dismiss notification')}
            >
              <StandardIcon.X size="sm" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default CookieConsentBanner;
