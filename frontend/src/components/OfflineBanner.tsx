import { WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

/**
 * Fixed banner shown app-wide whenever the browser has no network
 * connection. Disappears automatically as soon as connectivity returns.
 *
 * Rendered inside AppLayout, just below the header, so it's visible on
 * every page without each page needing to wire it up individually.
 */
export function OfflineBanner() {
  const { t } = useTranslation();
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-widest border-b"
      style={{
        background: 'color-mix(in srgb, var(--danger) 12%, var(--bg))',
        borderColor: 'var(--danger)',
        color: 'var(--danger)',
      }}
    >
      <WifiOff size={14} aria-hidden="true" />
      <span>{t('common.offlineBannerMessage')}</span>
    </div>
  );
}
