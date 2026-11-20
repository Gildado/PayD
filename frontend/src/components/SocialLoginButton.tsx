import React, { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Chrome, Github, Loader2 } from 'lucide-react';

export type SocialProvider = 'google' | 'github';

export interface SocialLoginButtonProps {
  /**
   * The social provider
   */
  provider: SocialProvider;
  /**
   * Callback when button is clicked
   */
  onClick?: () => void;
  /**
   * Whether the button is loading
   */
  isLoading?: boolean;
  /**
   * Whether the button is disabled
   */
  disabled?: boolean;
  /**
   * Button size variant
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Show only icon (no text)
   */
  iconOnly?: boolean;
  /**
   * Custom label override
   */
  label?: string;
  /**
   * Additional CSS classes
   */
  className?: string;
  /**
   * Whether fallback mode is active (e.g. primary provider unavailable) (#1274)
   */
  fallbackTriggered?: boolean;
  /**
   * Label override when fallback is triggered
   */
  fallbackLabel?: string;
  /**
   * Fallback callback when clicked during provider unavailability
   */
  onFallback?: () => void;
}

const providerConfig = {
  google: {
    name: 'Google',
    icon: Chrome,
    bgColor: 'bg-white hover:bg-gray-50 dark:bg-[var(--surface-hi)] dark:hover:bg-[var(--surface)]',
    textColor: 'text-gray-900 dark:text-[var(--text)]',
    borderColor: 'border-gray-300 dark:border-[var(--border-hi)]',
    accentColor: 'text-[var(--accent)]',
    defaultLabelKey: 'socialLogin.continueWithGoogle',
  },
  github: {
    name: 'GitHub',
    icon: Github,
    bgColor: 'bg-slate-900 hover:bg-slate-800 dark:bg-[var(--surface-hi)] dark:hover:bg-[var(--surface)]',
    textColor: 'text-white dark:text-[var(--text)]',
    borderColor: 'border-slate-700 dark:border-[var(--border-hi)]',
    accentColor: 'text-slate-400 dark:text-[var(--muted)]',
    defaultLabelKey: 'socialLogin.continueWithGithub',
  },
};

const sizeConfig = {
  sm: 'px-3 py-1.5 text-xs gap-2',
  md: 'px-4 py-2.5 text-sm gap-3',
  lg: 'px-6 py-3 text-base gap-3',
};

/**
 * SocialLoginButton Component
 *
 * Renders a styled button for OAuth2 social login providers.
 * Supports Google and GitHub with provider-specific branding.
 *
 * Features:
 * - Provider-specific theming
 * - Loading state with spinner
 * - Disabled state support
 * - Icon-only variant
 * - Full keyboard accessibility
 * - Touch-friendly sizes
 *
 * @example
 * ```tsx
 * <SocialLoginButton
 *   provider="google"
 *   onClick={() => handleGoogleLogin()}
 *   isLoading={isLoading}
 * />
 * ```
 */
// eslint-disable-next-line react-x/no-forward-ref
export const SocialLoginButton = forwardRef<HTMLButtonElement, SocialLoginButtonProps>(
  (
    {
      provider,
      onClick,
      isLoading = false,
      disabled = false,
      size = 'md',
      iconOnly = false,
      label,
      className = '',
      fallbackTriggered = false,
      fallbackLabel,
      onFallback,
    },
    ref
  ) => {
    const { t } = useTranslation();
    const config = providerConfig[provider];
    const ProviderIcon = config.icon;
    const effectiveLabel = fallbackTriggered
      ? (fallbackLabel || t('socialLogin.fallbackOption', `Use Alternate Login`))
      : (label || t(config.defaultLabelKey));
    const buttonLabel = effectiveLabel;
    const isDisabled = disabled || isLoading;

    const handleClick = () => {
      if (fallbackTriggered && onFallback) {
        onFallback();
        return;
      }
      onClick?.();
    };

    return (
      <button
        ref={ref}
        onClick={handleClick}
        disabled={isDisabled}
        className={`
          relative inline-flex items-center justify-center font-semibold rounded-lg
          border ${config.borderColor} ${config.bgColor} ${config.textColor}
          transition-all duration-200 ease-out
          focus:outline-none focus:ring-2 focus:ring-offset-2
          ${provider === 'google' ? 'focus:ring-[var(--accent)]' : 'focus:ring-slate-500'}
          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:${config.bgColor === 'bg-white hover:bg-gray-50' ? '' : ''}
          ${sizeConfig[size]}
          ${isDisabled ? 'hover:scale-100' : 'hover:scale-105 active:scale-95'}
          ${fallbackTriggered ? 'ring-1 ring-amber-400' : ''}
          ${className}
        `}
        aria-label={buttonLabel}
        aria-busy={isLoading}
        aria-disabled={isDisabled}
        type="button"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <ProviderIcon className="h-4 w-4" aria-hidden="true" />
        )}

        {!iconOnly && (
          <span className="font-semibold">
            {isLoading ? t('socialLogin.signingIn') : buttonLabel}
          </span>
        )}
      </button>
    );
  }
);

SocialLoginButton.displayName = 'SocialLoginButton';
