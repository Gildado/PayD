import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSocket } from '../hooks/useSocket';

/**
 * Small status badge that reflects the current WebSocket connection state.
 *
 * - Green  "Live"     — WebSocket connected and pushing updates.
 * - Yellow "Polling"  — WebSocket lost; app is falling back to HTTP polling.
 * - Red    "Offline"  — Not connected and no fallback active yet.
 */
export function ConnectionStatus() {
  const { t } = useTranslation();
  const { connected, isPollingFallback, isReconnecting } = useSocket();
  const [showTooltip, setShowTooltip] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion reduce)').matches;
  
  const handleMouseEnter = useCallback(() => {
    setIsExiting(false);
    setShowTooltip(true);
  }, []);
  
  const handleMouseLeave = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      setShowTooltip(false);
      setIsExiting(false);
    }, prefersReducedMotion ? 0 : 150);
  }, [prefersReducedMotion]);
  
  const handleFocus = useCallback(() => {
    setIsExiting(false);
    setShowTooltip(true);
  }, []);
  
  const handleBlur = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      setShowTooltip(false);
      setIsExiting(false);
    }, prefersReducedMotion ? 0 : 150);
  }, [prefersReducedMotion]);

  const getStatusInfo = () => {
    if (connected && !isPollingFallback) {
      return {
        label: t('connectionStatus.live'),
        description: t('connectionStatus.liveDescription'),
        bgClass: 'bg-success/10',
        textClass: 'text-success',
        borderClass: 'border-success/20',
        dotClass: 'bg-success',
        animate: 'animate-pulse',
      };
    }
    if (!connected && !isPollingFallback && isReconnecting) {
      return {
        label: t('connectionStatus.reconnecting'),
        description: t('connectionStatus.reconnectingDescription'),
        bgClass: 'bg-yellow-500/10',
        textClass: 'text-yellow-400',
        borderClass: 'border-yellow-500/20',
        dotClass: 'bg-yellow-400',
        animate: 'animate-pulse',
      };
    }
    if (isPollingFallback) {
      return {
        label: t('connectionStatus.polling'),
        description: t('connectionStatus.pollingDescription'),
        bgClass: 'bg-yellow-500/10',
        textClass: 'text-yellow-400',
        borderClass: 'border-yellow-500/20',
        dotClass: 'bg-yellow-400',
        animate: '',
      };
    }
    return {
      label: t('connectionStatus.offline'),
      description: t('connectionStatus.offlineDescription'),
      bgClass: 'bg-danger/10',
      textClass: 'text-danger',
      borderClass: 'border-danger/20',
      dotClass: 'bg-danger',
      animate: '',
    };
  };

  const status = getStatusInfo();

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        aria-label={t('connectionStatus.ariaLabel', { label: status.label, description: status.description })}
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-offset-2 min-h-7 ${status.bgClass} ${status.textClass} ${status.borderClass} border focus:ring-${status.textClass.replace('text-', '')} ${prefersReducedMotion ? '' : 'transition-all duration-(--motion-duration-fast) ease-(--motion-ease-out) hover:scale-105 hover:shadow-md active:scale-95 active:shadow-sm'}`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${status.dotClass} ${status.animate} ${prefersReducedMotion ? '' : 'transition-colors duration-(--motion-duration-normal) ease-(--motion-ease-out)'}`}
          style={!prefersReducedMotion ? { willChange: 'background-color' } : undefined}
          aria-hidden="true"
        />
        <span>{status.label}</span>
      </button>

      {showTooltip && (
        <div
          role="tooltip"
          className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 rounded-lg bg-(--surface) border border-(--border-hi) shadow-lg text-xs text-(--text) whitespace-nowrap z-50 ${prefersReducedMotion ? '' : 'transition-all duration-(--motion-duration-fast) ease-(--motion-ease-out)'} ${isExiting ? 'opacity-0 translate-y-2 scale-95' : 'opacity-100 translate-y-0 scale-100'}`}
          style={{
            transitionDuration: prefersReducedMotion ? '0ms' : undefined,
            transitionTimingFunction: prefersReducedMotion ? undefined : 'var(--motion-ease-out)',
            willChange: !prefersReducedMotion ? 'opacity, transform' : undefined
          }}
        >
          {status.description}
          <div
            className={`absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-(--surface) border-r border-b border-(--border-hi) transform rotate-45 -mt-1 ${prefersReducedMotion ? '' : 'transition-opacity duration-(--motion-duration-fast) ease-(--motion-ease-out)'}`}
            style={{ opacity: isExiting ? 0 : 1 }}
            aria-hidden="true"
          />
        </div>
      )}
    </div>
  );
}