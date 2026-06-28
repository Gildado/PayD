import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export interface OAuthCallbackHandlerProps {
  /**
   * Callback to validate and store the token
   */
  onTokenReceived: (token: string) => Promise<void>;
  /**
   * Callback when authentication succeeds
   */
  onSuccess?: () => void;
  /**
   * Callback when authentication fails
   */
  onError?: (error: string) => void;
  /**
   * Where to redirect after success
   */
  redirectTo?: string;
  /**
   * Additional CSS classes
   */
  className?: string;
}

type CallbackState = 'loading' | 'success' | 'error' | 'validating';

/**
 * OAuthCallbackHandler Component
 *
 * Handles OAuth2 callback processing.
 * Validates tokens, manages loading/error states, and redirects on success.
 *
 * Features:
 * - Automatic token extraction from URL
 * - Token validation
 * - Loading state with spinner
 * - Error handling with retry
 * - Success confirmation
 * - Automatic redirect after success
 * - Full accessibility support
 *
 * @example
 * ```tsx
 * <OAuthCallbackHandler
 *   onTokenReceived={async (token) => {
 *     await AuthService.setToken(token);
 *   }}
 *   redirectTo="/dashboard"
 * />
 * ```
 */
export const OAuthCallbackHandler: React.FC<OAuthCallbackHandlerProps> = ({
  onTokenReceived,
  onSuccess,
  onError,
  redirectTo = '/',
  className = '',
}) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<CallbackState>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      try {
        const token = searchParams.get('token');
        const errorParam = searchParams.get('error');

        // Check for error from OAuth provider
        if (errorParam) {
          const errorMessage = getErrorMessage(errorParam);
          setError(errorMessage);
          setState('error');
          onError?.(errorMessage);
          return;
        }

        // Check for missing token
        if (!token) {
          const errorMessage = 'No authentication token received';
          setError(errorMessage);
          setState('error');
          onError?.(errorMessage);
          return;
        }

        // Validate token format
        setState('validating');
        if (!isValidJWT(token)) {
          throw new Error('Invalid token format');
        }

        // Store token and process
        await onTokenReceived(token);

        setState('success');
        onSuccess?.();

        // Redirect after a short delay to show success message
        const timer = setTimeout(() => {
          void navigate(redirectTo, { replace: true });
        }, 1500);

        return () => clearTimeout(timer);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
        setError(errorMessage);
        setState('error');
        onError?.(errorMessage);
      }
    };

    void processCallback();
  }, [searchParams, onTokenReceived, onSuccess, onError, navigate, redirectTo]);

  const handleRetry = () => {
    window.location.reload();
  };

  if (state === 'loading' || state === 'validating') {
    return (
      <div className={`flex flex-col items-center justify-center min-h-screen gap-4 ${className}`}>
        <div className="p-6 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20">
          <Loader2 size={32} className="text-[var(--accent)] animate-spin" aria-hidden="true" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-[var(--text)]">
            {state === 'validating' ? 'Verifying your identity' : 'Signing you in'}
          </h2>
          <p className="text-sm text-[var(--muted)] mt-2">
            Please wait while we process your authentication...
          </p>
        </div>

        {/* Accessible loading announcement */}
        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {state === 'validating'
            ? 'Verifying your identity. Please wait.'
            : 'Signing you in. Please wait.'}
        </div>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className={`flex flex-col items-center justify-center min-h-screen gap-4 ${className}`}>
        <div className="p-6 rounded-full bg-green-500/10 border border-green-500/20">
          <CheckCircle size={32} className="text-green-400" aria-hidden="true" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-[var(--text)]">Welcome back!</h2>
          <p className="text-sm text-[var(--muted)] mt-2">
            You're being redirected to your dashboard...
          </p>
        </div>

        {/* Accessible success announcement */}
        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          Authentication successful. Redirecting you now.
        </div>
      </div>
    );
  }

  if (state === 'error' && error) {
    return (
      <div className={`flex flex-col items-center justify-center min-h-screen gap-4 ${className}`}>
        <div className="p-6 rounded-full bg-red-500/10 border border-red-500/20">
          <AlertCircle size={32} className="text-red-400" aria-hidden="true" />
        </div>
        <div className="text-center max-w-md">
          <h2 className="text-lg font-semibold text-[var(--text)]">Authentication failed</h2>
          <p className="text-sm text-[var(--muted)] mt-2">{error}</p>

          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={handleRetry}
              className="px-4 py-2.5 rounded-lg bg-[var(--accent)] text-[var(--bg)] font-medium hover:bg-[var(--accent)]/90 transition-colors"
              type="button"
            >
              Try Again
            </button>
            <button
              onClick={() => void navigate('/login', { replace: true })}
              className="px-4 py-2.5 rounded-lg border border-[var(--border-hi)] text-[var(--text)] hover:bg-[var(--surface)] transition-colors"
              type="button"
            >
              Back to Login
            </button>
          </div>
        </div>

        {/* Accessible error announcement */}
        <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
          {error}
        </div>
      </div>
    );
  }

  return null;
};

// Helper: Validate JWT format
function isValidJWT(token: string): boolean {
  const jwtRegex = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
  return jwtRegex.test(token);
}

// Helper: Get user-friendly error message
function getErrorMessage(errorCode: string): string {
  const errorMessages: Record<string, string> = {
    access_denied: 'You denied access to your account. Please try again.',
    invalid_scope: 'The authentication request had invalid permissions. Please contact support.',
    server_error: 'The authentication server encountered an error. Please try again later.',
    timeout: 'Authentication request timed out. Please try again.',
    no_token: 'No authentication token received. Please try again.',
    invalid_token: 'Invalid authentication token. Please try again.',
  };

  return errorMessages[errorCode] || 'Authentication failed. Please try again.';
}

OAuthCallbackHandler.displayName = 'OAuthCallbackHandler';
