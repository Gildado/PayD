import React from 'react';
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
    color: 'text-[var(--accent)]',
  },
  github: {
    name: 'GitHub',
    icon: Github,
    color: 'text-slate-400',
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
      aria-label="Connected social providers"
    >
      {providers.map((provider) => {
        const config = providerConfig[provider.provider];
        const ProviderIcon = config.icon;
        const StatusIcon = provider.isConnected ? Check : X;
        const statusColor = provider.isConnected
          ? 'bg-green-500/20 border-green-500/30'
          : 'bg-gray-500/10 border-gray-500/20';
        const statusTextColor = provider.isConnected ? 'text-green-400' : 'text-gray-400';

        return (
          <div
            key={provider.provider}
            className={`rounded-lg border ${statusColor} ${cardPadding} flex items-center justify-between`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={`${config.color}`}>
                <ProviderIcon size={iconSize} aria-hidden="true" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`${textSize} font-semibold text-[var(--text)]`}>{config.name}</p>
                  <span
                    className={`inline-flex items-center ${textSize} font-medium ${statusTextColor}`}
                    role="img"
                    aria-label={
                      provider.isConnected
                        ? `${config.name} connected`
                        : `${config.name} not connected`
                    }
                  >
                    <StatusIcon size={14} aria-hidden="true" />
                  </span>
                </div>

                {provider.isConnected && provider.email && (
                  <p className={`${textSize} text-[var(--muted)] truncate mt-1`}>
                    {provider.email}
                  </p>
                )}

                {provider.isConnected && provider.connectedAt && (
                  <p className={`${textSize} text-[var(--muted)]/70 mt-1`}>
                    Connected{' '}
                    <time dateTime={provider.connectedAt}>
                      {new Date(provider.connectedAt).toLocaleDateString()}
                    </time>
                  </p>
                )}

                {!provider.isConnected && (
                  <p className={`${textSize} text-[var(--muted)]`}>Not connected</p>
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
