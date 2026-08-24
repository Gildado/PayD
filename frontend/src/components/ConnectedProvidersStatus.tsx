import React from 'react';
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
      {providers.map((provider) => {
        const config = providerConfig[provider.provider];
        const ProviderIcon = config.icon;
        const StatusIcon = provider.isConnected ? Check : X;

        return (
          <div
            key={provider.provider}
            className={`rounded-lg border ${cardPadding} flex items-center justify-between transition-all`}
            style={{
              backgroundColor: provider.isConnected ? 'var(--success)/10' : 'var(--surface)',
              borderColor: provider.isConnected ? 'var(--success)' : 'var(--border)',
              transitionDuration: 'var(--motion-duration-fast)',
              transitionTimingFunction: 'var(--motion-ease-out)',
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
                    className={`inline-flex items-center ${textSize} font-medium`}
                    style={{ color: provider.isConnected ? 'var(--success)' : 'var(--muted)' }}
                    role="img"
                    aria-label={
                      provider.isConnected
                        ? t('connectedProviders.connectedLabel', { provider: config.name })
                        : t('connectedProviders.notConnectedLabel', { provider: config.name })
                    }
                  >
                    <StatusIcon size={14} aria-hidden="true" />
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
    </div>
  );
};

ConnectedProvidersStatus.displayName = 'ConnectedProvidersStatus';
