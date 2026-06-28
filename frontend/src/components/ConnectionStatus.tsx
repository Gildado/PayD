import { useState } from 'react';
import { useSocket } from '../hooks/useSocket';

/**
 * Small status badge that reflects the current WebSocket connection state.
 *
 * - Green  "Live"     — WebSocket connected and pushing updates.
 * - Yellow "Polling"  — WebSocket lost; app is falling back to HTTP polling.
 * - Red    "Offline"  — Not connected and no fallback active yet.
 */
export function ConnectionStatus() {
  const { connected, isPollingFallback } = useSocket();
  const [showTooltip, setShowTooltip] = useState(false);

  const getStatusInfo = () => {
    if (connected && !isPollingFallback) {
      return {
        label: 'Live',
        description: 'Real-time updates active via WebSocket',
        bgClass: 'bg-success/10',
        textClass: 'text-success',
        borderClass: 'border-success/20',
        dotClass: 'bg-success',
        animate: 'animate-pulse',
      };
    }
    if (isPollingFallback) {
      return {
        label: 'Polling',
        description: 'Using HTTP polling for updates',
        bgClass: 'bg-yellow-500/10',
        textClass: 'text-yellow-400',
        borderClass: 'border-yellow-500/20',
        dotClass: 'bg-yellow-400',
        animate: '',
      };
    }
    return {
      label: 'Offline',
      description: 'No connection - updates paused',
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
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        aria-label={`Connection status: ${status.label}. ${status.description}`}
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 min-h-[28px] ${status.bgClass} ${status.textClass} ${status.borderClass} border focus:ring-${status.textClass.replace('text-', '')}`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${status.dotClass} ${status.animate}`}
          aria-hidden="true"
        />
        <span>{status.label}</span>
      </button>

      {showTooltip && (
        <div
          role="tooltip"
          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 rounded-lg bg-(--surface) border border-(--border-hi) shadow-lg text-xs text-(--text) whitespace-nowrap z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          {status.description}
          <div
            className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-(--surface) border-r border-b border-(--border-hi) transform rotate-45 -mt-1"
            aria-hidden="true"
          />
        </div>
      )}
    </div>
  );
}
