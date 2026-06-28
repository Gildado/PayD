import React, { useState } from 'react';
import { Chrome, Github, Link2, Trash2, AlertCircle } from 'lucide-react';

export type SocialProvider = 'google' | 'github';

export interface SocialIdentity {
  provider: SocialProvider;
  email?: string;
  displayName?: string;
  profileUrl?: string;
  connectedAt?: string;
  isPrimary?: boolean;
}

export interface SocialIdentityManagerProps {
  /**
   * Array of linked social identities
   */
  identities: SocialIdentity[];
  /**
   * Whether any async operation is in progress
   */
  isLoading?: boolean;
  /**
   * Callback to link a new provider
   */
  onLinkProvider?: (provider: SocialProvider) => void;
  /**
   * Callback to unlink a provider
   */
  onUnlinkProvider?: (provider: SocialProvider) => void;
  /**
   * Callback to set as primary
   */
  onSetPrimary?: (provider: SocialProvider) => void;
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
    shortName: 'Google',
  },
  github: {
    name: 'GitHub',
    icon: Github,
    color: 'text-slate-400',
    shortName: 'GitHub',
  },
};

/**
 * SocialIdentityManager Component
 *
 * Manages linked social accounts for a user.
 * Allows viewing, linking, and unlinking social providers.
 *
 * Features:
 * - Display all linked social identities
 * - Link new social providers
 * - Unlink existing providers
 * - Mark primary account
 * - Account details (email, name, connection date)
 * - Full accessibility support
 *
 * @example
 * ```tsx
 * <SocialIdentityManager
 *   identities={linkedAccounts}
 *   onLinkProvider={handleLink}
 *   onUnlinkProvider={handleUnlink}
 * />
 * ```
 */
export const SocialIdentityManager: React.FC<SocialIdentityManagerProps> = ({
  identities,
  isLoading = false,
  onLinkProvider,
  onUnlinkProvider,
  onSetPrimary,
  className = '',
}) => {
  const [confirmUnlink, setConfirmUnlink] = useState<SocialProvider | null>(null);

  const linkedProviders = identities.map((id) => id.provider);
  const availableProviders: SocialProvider[] = (['google', 'github'] as const).filter(
    (p) => !linkedProviders.includes(p)
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Linked Identities Section */}
      {identities.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[var(--text)] mb-4">Connected Accounts</h3>

          <div className="space-y-3">
            {identities.map((identity) => {
              const config = providerConfig[identity.provider];
              const ProviderIcon = config.icon;

              return (
                <div
                  key={identity.provider}
                  className="flex items-center justify-between rounded-lg border border-[var(--border-hi)] bg-[var(--surface)]/50 p-4 transition-all hover:bg-[var(--surface)]"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`p-2 rounded-lg bg-[var(--surface)] ${config.color}`}>
                      <ProviderIcon size={20} aria-hidden="true" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-semibold text-[var(--text)]">{config.name}</h4>
                        {identity.isPrimary && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[var(--accent)]/20 text-[var(--accent)]">
                            Primary
                          </span>
                        )}
                      </div>

                      {identity.email && (
                        <p className="text-xs text-[var(--muted)] mt-1 truncate">
                          {identity.email}
                        </p>
                      )}

                      {identity.displayName && (
                        <p className="text-xs text-[var(--muted)]">{identity.displayName}</p>
                      )}

                      {identity.connectedAt && (
                        <p className="text-xs text-[var(--muted)]/70 mt-1">
                          Connected {new Date(identity.connectedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 ml-4">
                    {!identity.isPrimary && onSetPrimary && (
                      <button
                        onClick={() => onSetPrimary(identity.provider)}
                        disabled={isLoading}
                        className="px-3 py-1.5 text-xs font-medium rounded border border-[var(--border-hi)] text-[var(--text)] hover:bg-[var(--surface)] transition-colors disabled:opacity-50"
                        aria-label={`Set ${config.name} as primary account`}
                        type="button"
                      >
                        Set Primary
                      </button>
                    )}

                    {onUnlinkProvider && (
                      <button
                        onClick={() => setConfirmUnlink(identity.provider)}
                        disabled={isLoading || identities.length === 1}
                        className="p-2 text-[var(--muted)] hover:text-red-400 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label={`Unlink ${config.name} account`}
                        title={
                          identities.length === 1 ? 'Keep at least one account linked' : undefined
                        }
                        type="button"
                      >
                        <Trash2 size={18} aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  {/* Unlink Confirmation */}
                  {confirmUnlink === identity.provider && (
                    <div className="absolute inset-0 rounded-lg bg-black/50 flex items-center justify-center z-50">
                      <div className="bg-[var(--bg)] border border-[var(--border-hi)] rounded-lg p-4 max-w-sm mx-4">
                        <h4 className="font-semibold text-[var(--text)] mb-2">Unlink Account?</h4>
                        <p className="text-sm text-[var(--muted)] mb-4">
                          You can always link your {config.name} account again later.
                        </p>
                        <div className="flex gap-3">
                          <button
                            onClick={() => setConfirmUnlink(null)}
                            className="flex-1 px-3 py-2 rounded border border-[var(--border-hi)] text-[var(--text)] hover:bg-[var(--surface)]"
                            type="button"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              onUnlinkProvider?.(identity.provider);
                              setConfirmUnlink(null);
                            }}
                            className="flex-1 px-3 py-2 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30"
                            type="button"
                          >
                            Unlink
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Link New Provider Section */}
      {availableProviders.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[var(--text)] mb-4">
            Link Additional Accounts
          </h3>

          <div className="grid gap-3 sm:grid-cols-2">
            {availableProviders.map((provider) => {
              const config = providerConfig[provider];

              return (
                <button
                  key={provider}
                  onClick={() => onLinkProvider?.(provider)}
                  disabled={isLoading}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-[var(--border-hi)] bg-[var(--surface)]/50 text-[var(--text)] hover:bg-[var(--surface)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={`Link ${config.name} account`}
                  type="button"
                >
                  <Link2 size={18} aria-hidden="true" />
                  <span className="font-medium">Link {config.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Min Account Warning */}
      {identities.length === 1 && (
        <div className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <AlertCircle size={20} className="text-amber-400 flex-shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="text-sm font-medium text-amber-300">One account remaining</p>
            <p className="text-xs text-amber-400/80 mt-1">
              Link another account before unlinking your last one.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

SocialIdentityManager.displayName = 'SocialIdentityManager';
