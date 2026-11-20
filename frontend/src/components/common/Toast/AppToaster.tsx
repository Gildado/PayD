import React, { use } from 'react';
import { Toaster } from 'sonner';
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from 'lucide-react';
import { ThemeContext } from '../../../hooks/useTheme';

const iconClass = 'payd-toast-icon';

const icons = {
  success: (
    <span className={iconClass}>
      <CheckCircle2 size={16} strokeWidth={2.25} aria-hidden="true" />
    </span>
  ),
  error: (
    <span className={iconClass}>
      <XCircle size={16} strokeWidth={2.25} aria-hidden="true" />
    </span>
  ),
  warning: (
    <span className={iconClass}>
      <AlertTriangle size={16} strokeWidth={2.25} aria-hidden="true" />
    </span>
  ),
  info: (
    <span className={iconClass}>
      <Info size={16} strokeWidth={2.25} aria-hidden="true" />
    </span>
  ),
  loading: (
    <span className={iconClass}>
      <Loader2
        size={16}
        strokeWidth={2.25}
        className="motion-safe:animate-spin"
        aria-hidden="true"
      />
    </span>
  ),
};

/**
 * The single toast viewport for the app (#1500). Every toast — whether raised
 * through `useNotification`, `useToast` or a direct `sonner` call — renders
 * here with PayD's design tokens, so feedback looks the same everywhere.
 *
 * Sonner provides the polite live region, the Alt+T focus hotkey, swipe to
 * dismiss and reduced-motion handling; the theme follows ThemeProvider.
 */
export const AppToaster: React.FC = () => {
  const theme = use(ThemeContext)?.theme ?? 'light';

  return (
    <Toaster
      theme={theme}
      position="top-right"
      closeButton
      visibleToasts={4}
      gap={12}
      offset={24}
      mobileOffset={16}
      duration={5000}
      icons={icons}
      containerAriaLabel="Notifications"
      toastOptions={{
        classNames: {
          toast: 'payd-toast',
          title: 'payd-toast-title',
          description: 'payd-toast-description',
          actionButton: 'payd-toast-action',
          cancelButton: 'payd-toast-cancel',
          closeButton: 'payd-toast-close',
        },
      }}
    />
  );
};
