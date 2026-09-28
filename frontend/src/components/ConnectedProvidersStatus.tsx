import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Chrome, Github, Check, X } from 'lucide-react';

export type SocialProvider = 'google' | 'github';

export interface ConnectedProvider {
  provider: SocialProvider;
  isConnected: boolean;
  email?: string;
  displayName?: string;
  connectedAt?: string;
}

export interface ConnectedProvidersStatusProps {
  /**
   * Array of provider connection statuses
   */
  providers: ConnectedProvider[];
  /**
   * Size variant
   */
  size?: 'sm' | 'md';
  /**
   * Additional CSS classes
   */
  className?: string;
}

const providerConfig = {
  google: {
    name: 'Google',
    icon: Chrome,
    color: 'var(--accent)',
  },
  github: {
    name: 'GitHub',
    icon: Github,
    color: 'var(--muted)',
  },
};

/**
 * ConnectedProvidersStatus Component
 *
 * Displays the connection status of social providers in a compact format.
 * Shows which providers are connected and their details.
 *
 * Interaction & motion (issue #1405):
 * - Staggered entrance animation using the shared `fadeUp` keyframes and the
 *   motion token durations/easings (`--motion-duration-*`, `--motion-ease-*`)
 * - Hover lift + elevated shadow via `--shadow-card`/`--shadow-card-hover`
 * - Press feedback (scale down/up) on each card
 * - Smooth status transitions when a provider connects/disconnects
 *   (background/border cross-fade plus a scale "pop" on the status icon)
 * - All state changes are compositor-friendly (transform/opacity) or cheap
 *   paint-only property transitions to stay at 60fps
 * - Every animation is disabled/simplified under `prefers-reduced-motion`
 *
 * Features:
 * - Visual status indicators (connected/disconnected)
 * - Provider-specific icons and colors
 * - Connected email display
 * - Connection date information
 * - Responsive layout
 * - Full accessibility support
 *
 * @example
 * ```tsx
 * <ConnectedProvidersStatus
 *   providers={[
 *     { provider: 'google', isConnected: true, email: 'user@gmail.com' },
 *     { provider: 'github', isConnected: false }
 *   ]}
 * />
 * ```
 */
export const ConnectedProvidersStatus: React.FC<ConnectedProvidersStatusProps> = ({
  providers,
  size = 'md',
  className = '',
}) => {
  const { t, i18n } = useTranslation();
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  // Track live changes to the user's reduced-motion preference.
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  if (providers.length === 0) {
    return null;
  }

  const containerClass = size === 'sm' ? 'gap-2' : 'gap-3';
  const cardPadding = size === 'sm' ? 'p-3' : 'p-4';
  const iconSize = size === 'sm' ? 16 : 20;
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div
      className={`grid ${containerClass} ${className}`}
      role="status"
      aria-label={t('connectedProviders.ariaLabel')}
    >
      {providers.map((provider, index) => {
        const config = providerConfig[provider.provider];
        const ProviderIcon = config.icon;
        const StatusIcon = provider.isConnected ? Check : X;

        return (
          <div
            key={provider.provider}
            className={`rounded-lg border ${cardPadding} flex items-center justify-between`}
            style={{
              backgroundColor: provider.isConnected
                ? 'color-mix(in srgb, var(--success) 10%, transparent)'
                : 'var(--surface)',
              borderColor: provider.isConnected ? 'var(--success)' : 'var(--border)',
              boxShadow: 'var(--shadow-card)',
              willChange: reducedMotion ? undefined : 'transform',
              transition: reducedMotion
                ? 'none'
                : [
                    `background-color var(--motion-duration-normal) var(--motion-ease-out)`,
                    `border-color var(--motion-duration-normal) var(--motion-ease-out)`,
                    `box-shadow var(--motion-duration-normal) var(--motion-ease-out)`,
                    `transform var(--motion-duration-fast) var(--motion-ease-out)`,
                  ].join(', '),
              // Staggered entrance reusing the shared fadeUp keyframes; both
              // fill mode keeps cards invisible until their turn (no flash).
              animation: reducedMotion
                ? 'none'
                : `fadeUp var(--motion-duration-slow) var(--motion-ease-out) ${index * 60}ms both`,
            }}
            onMouseEnter={(e) => {
              if (!reducedMotion) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)';
                e.currentTarget.style.borderColor = provider.isConnected
                  ? 'var(--success)'
                  : 'var(--border-hi)';
              }
            }}
            onMouseLeave={(e) => {
              if (!reducedMotion) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'var(--shadow-card)';
                e.currentTarget.style.borderColor = provider.isConnected
                  ? 'var(--success)'
                  : 'var(--border)';
              }
            }}
            onMouseDown={(e) => {
              if (!reducedMotion) e.currentTarget.style.transform = 'translateY(0) scale(0.98)';
            }}
            onMouseUp={(e) => {
              if (!reducedMotion) e.currentTarget.style.transform = 'translateY(-2px)';
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div style={{ color: config.color }}>
                <ProviderIcon size={iconSize} aria-hidden="true" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`${textSize} font-semibold`} style={{ color: 'var(--text)' }}>
                    {config.name}
                  </p>
                  <span
                    key={`${provider.provider}-${provider.isConnected}`}
                    className={`inline-flex items-center ${textSize} font-medium`}
                    style={{
                      color: provider.isConnected ? 'var(--success)' : 'var(--muted)',
                      transition: reducedMotion
                        ? 'none'
                        : `color var(--motion-duration-normal) var(--motion-ease-out), transform var(--motion-duration-normal) var(--motion-ease-bounce)`,
                    }}
                    role="img"
                    aria-label={
                      provider.isConnected
                        ? t('connectedProviders.connectedLabel', { provider: config.name })
                        : t('connectedProviders.notConnectedLabel', { provider: config.name })
                    }
                  >
                    <StatusIcon
                      size={14}
                      aria-hidden="true"
                      // Scale "pop" whenever the connection state flips; the
                      // key change remounts the icon so the entrance replays.
                      style={{
                        animation: reducedMotion
                          ? 'none'
                          : `statusIconPop var(--motion-duration-normal) var(--motion-ease-bounce) both`,
                      }}
                    />
                  </span>
                </div>

                {provider.isConnected && provider.email && (
                  <p className={`${textSize} truncate mt-1`} style={{ color: 'var(--muted)' }}>
                    {provider.email}
                  </p>
                )}

                {provider.isConnected && provider.connectedAt && (
                  <p className={`${textSize} mt-1`} style={{ color: 'var(--muted)' }}>
                    {t('connectedProviders.connected')}{' '}
                    <time dateTime={provider.connectedAt}>
                      {new Date(provider.connectedAt).toLocaleDateString(i18n.language)}
                    </time>
                  </p>
                )}

                {!provider.isConnected && (
                  <p className={`${textSize}`} style={{ color: 'var(--muted)' }}>
                    {t('connectedProviders.notConnected')}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
      <style>{`
        @keyframes statusIconPop {
          0% { transform: scale(0.4); opacity: 0; }
          60% { transform: scale(1.25); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes statusIconPop {
            from { opacity: 1; }
            to { opacity: 1; }
          }
        }
      `}</style>
    </div>
  );
};

ConnectedProvidersStatus.displayName = 'ConnectedProvidersStatus';
