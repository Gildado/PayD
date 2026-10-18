import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StandardIcon } from './common/Icon';

export interface PartnerOrg {
  id: string;
  name: string;
  category: string;
  badge?: string;
  renderLogo: (className?: string) => React.ReactNode;
}

// eslint-disable-next-line react-refresh/only-export-components
export const PARTNERS: PartnerOrg[] = [
  {
    id: 'stellar',
    name: 'Stellar Development Foundation',
    category: 'Settlement Layer',
    badge: 'L1 Network',
    renderLogo: (className = 'h-7 w-auto') => (
      <svg className={className} viewBox="0 0 120 32" fill="none" aria-hidden="true">
        <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="2" />
        <path d="M7 16h18M16 7v18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <text
          x="36"
          y="20"
          fill="currentColor"
          fontFamily="var(--font-head)"
          fontSize="14"
          fontWeight="700"
          letterSpacing="-0.02em"
        >
          stellar
        </text>
      </svg>
    ),
  },
  {
    id: 'circle',
    name: 'Circle USDC',
    category: 'Treasury & Liquidity',
    badge: 'Stablecoin',
    renderLogo: (className = 'h-7 w-auto') => (
      <svg className={className} viewBox="0 0 110 32" fill="none" aria-hidden="true">
        <circle cx="16" cy="16" r="11" stroke="currentColor" strokeWidth="2" />
        <path d="M16 9v14M12 12.5c1-1 3.5-1 4.5 0s0 2.5-1 3.5l-3 2c-1 1 0 2.5 1.5 2.5h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <text
          x="35"
          y="20"
          fill="currentColor"
          fontFamily="var(--font-head)"
          fontSize="14"
          fontWeight="700"
          letterSpacing="-0.02em"
        >
          USDC
        </text>
      </svg>
    ),
  },
  {
    id: 'soroban',
    name: 'Soroban Smart Contracts',
    category: 'Escrow Engine',
    badge: 'Rust Engine',
    renderLogo: (className = 'h-7 w-auto') => (
      <svg className={className} viewBox="0 0 120 32" fill="none" aria-hidden="true">
        <rect x="6" y="6" width="20" height="20" rx="6" stroke="currentColor" strokeWidth="2" />
        <path d="M12 16h8M16 12v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <text
          x="34"
          y="20"
          fill="currentColor"
          fontFamily="var(--font-head)"
          fontSize="13"
          fontWeight="700"
          letterSpacing="-0.02em"
        >
          soroban
        </text>
      </svg>
    ),
  },
  {
    id: 'yellowcard',
    name: 'Yellow Card Financial',
    category: 'Pan-African On/Off-Ramp',
    badge: 'Fiat Rail',
    renderLogo: (className = 'h-7 w-auto') => (
      <svg className={className} viewBox="0 0 130 32" fill="none" aria-hidden="true">
        <rect x="6" y="6" width="20" height="20" rx="4" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="2" />
        <path d="M12 12l8 8M20 12l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <text
          x="34"
          y="20"
          fill="currentColor"
          fontFamily="var(--font-head)"
          fontSize="13"
          fontWeight="700"
          letterSpacing="-0.02em"
        >
          Yellow Card
        </text>
      </svg>
    ),
  },
  {
    id: 'flutterwave',
    name: 'Flutterwave',
    category: 'Payment Infrastructure',
    badge: 'Fiat Partner',
    renderLogo: (className = 'h-7 w-auto') => (
      <svg className={className} viewBox="0 0 130 32" fill="none" aria-hidden="true">
        <path d="M8 20c3-6 7-6 10 0s7 6 10 0" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <text
          x="36"
          y="20"
          fill="currentColor"
          fontFamily="var(--font-head)"
          fontSize="13"
          fontWeight="700"
          letterSpacing="-0.02em"
        >
          flutterwave
        </text>
      </svg>
    ),
  },
  {
    id: 'moneygram',
    name: 'MoneyGram Access',
    category: 'Cash-to-Crypto Network',
    badge: 'Cash In/Out',
    renderLogo: (className = 'h-7 w-auto') => (
      <svg className={className} viewBox="0 0 135 32" fill="none" aria-hidden="true">
        <circle cx="16" cy="16" r="10" stroke="currentColor" strokeWidth="2" />
        <path d="M12 16l3 3 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <text
          x="34"
          y="20"
          fill="currentColor"
          fontFamily="var(--font-head)"
          fontSize="13"
          fontWeight="700"
          letterSpacing="-0.02em"
        >
          MoneyGram
        </text>
      </svg>
    ),
  },
  {
    id: 'mercycorps',
    name: 'Mercy Corps Ventures',
    category: 'Impact Partner',
    badge: 'Financial Inclusion',
    renderLogo: (className = 'h-7 w-auto') => (
      <svg className={className} viewBox="0 0 130 32" fill="none" aria-hidden="true">
        <path d="M7 21c4-1 9-5 10-12-5 1-9 5-10 12z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <text
          x="26"
          y="20"
          fill="currentColor"
          fontFamily="var(--font-head)"
          fontSize="12"
          fontWeight="700"
          letterSpacing="-0.02em"
        >
          MERCY CORPS
        </text>
      </svg>
    ),
  },
  {
    id: 'techstars',
    name: 'Techstars',
    category: 'Portfolio Org',
    badge: 'Accelerator',
    renderLogo: (className = 'h-7 w-auto') => (
      <svg className={className} viewBox="0 0 115 32" fill="none" aria-hidden="true">
        <polygon points="16 6 19 13 26 14 21 19 22 26 16 22 10 26 11 19 6 14 13 13 16 6" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <text
          x="34"
          y="20"
          fill="currentColor"
          fontFamily="var(--font-head)"
          fontSize="13"
          fontWeight="700"
          letterSpacing="-0.02em"
        >
          techstars
        </text>
      </svg>
    ),
  },
];

export interface PartnerLogoCarouselProps {
  className?: string;
  items?: PartnerOrg[];
}

export const PartnerLogoCarousel: React.FC<PartnerLogoCarouselProps> = ({
  className = '',
  items = PARTNERS,
}) => {
  const { t } = useTranslation();
  const [isPaused, setIsPaused] = useState(false);

  // Duplicate list to achieve infinite seamless loop
  const displayItems = [...items, ...items];

  const title = t('home.partnersTitle', 'Trusted by leading Web3 & financial organizations');
  const subtitle = t(
    'home.partnersSubtitle',
    'Integrated with Tier-1 liquidity rails, smart contract engines, and cross-border settlement infrastructure.'
  );

  return (
    <section
      className={`relative w-full py-10 sm:py-14 border-y border-border/80 bg-[color-mix(in_srgb,var(--surface-hi)_45%,var(--bg))] ${className}`}
      aria-labelledby="partner-carousel-title"
      role="region"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-accent">
              {t('home.partnersEyebrow', 'Ecosystem & Infrastructure')}
            </p>
            <h2
              id="partner-carousel-title"
              className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-text"
            >
              {title}
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-muted max-w-2xl leading-relaxed">
              {subtitle}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsPaused((prev) => !prev)}
            aria-pressed={isPaused}
            aria-label={
              isPaused
                ? t('home.resumePartnerMarquee', 'Resume auto-scrolling partner logos')
                : t('home.pausePartnerMarquee', 'Pause auto-scrolling partner logos')
            }
            className="inline-flex items-center gap-2 self-start sm:self-auto px-3 py-1.5 rounded-full border border-border text-xs font-medium text-muted hover:text-text hover:border-border-hi transition-colors"
          >
            {isPaused ? (
              <>
                <StandardIcon.Play size="xs" className="text-accent" />
                <span>{t('home.play', 'Play')}</span>
              </>
            ) : (
              <>
                <StandardIcon.Pause size="xs" className="text-muted" />
                <span>{t('home.pause', 'Pause')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Marquee ticker container with gradient fade edges */}
      <div className="partner-marquee-wrapper" tabIndex={0} aria-label="Partner logos carousel track">
        <div
          className={`partner-marquee-track py-2 ${isPaused ? 'is-paused' : ''}`}
          role="list"
          aria-label="List of partner logos"
        >
          {displayItems.map((partner, index) => {
            const key = `${partner.id}-${index}`;
            return (
              <div
                key={key}
                role="listitem"
                className="group relative flex items-center gap-3.5 rounded-2xl border border-border/80 bg-surface px-5 py-3.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md shrink-0 text-muted hover:text-text focus-within:ring-2 focus-within:ring-accent/40"
              >
                <div className="transition-colors group-hover:text-accent">
                  {partner.renderLogo('h-6 w-auto')}
                </div>
                {partner.badge && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border border-border bg-surface-hi text-muted group-hover:border-accent/30 group-hover:text-accent">
                    {partner.badge}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default PartnerLogoCarousel;
