import React, { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';

interface InfoTooltipProps {
  /** The explanation text shown in the tooltip. */
  content: string;
  /** Optional accessible label for the trigger button. Defaults to "More information". */
  label?: string;
  /** Preferred position of the tooltip. Defaults to "top". */
  position?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * A small ⓘ button that shows a descriptive tooltip when focused or hovered.
 * Keyboard-accessible, screen-reader friendly, and mobile-optimized.
 */
export const InfoTooltip: React.FC<InfoTooltipProps> = ({
  content,
  label = 'More information',
  position = 'top',
}) => {
  const [visible, setVisible] = useState(false);
  const [actualPosition, setActualPosition] = useState(position);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Adjust tooltip position to stay within viewport
  useEffect(() => {
    if (!visible || !tooltipRef.current || !triggerRef.current) return;

    const tooltip = tooltipRef.current;
    const rect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let newPosition = position;

    // Check if tooltip overflows viewport
    if (position === 'top' && rect.top < 0) {
      newPosition = 'bottom';
    } else if (position === 'bottom' && rect.bottom > viewportHeight) {
      newPosition = 'top';
    } else if (position === 'left' && rect.left < 0) {
      newPosition = 'right';
    } else if (position === 'right' && rect.right > viewportWidth) {
      newPosition = 'left';
    }

    setActualPosition(newPosition);
  }, [visible, position]);

  // Close tooltip on outside click
  useEffect(() => {
    if (!visible) return;
    const handleClick = (e: MouseEvent) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        setVisible(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [visible]);

  // Close on Escape key
  useEffect(() => {
    if (!visible) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setVisible(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [visible]);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 -mt-1 border-l border-b',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 -mb-1 border-r border-t',
    left: 'left-full top-1/2 -translate-y-1/2 -ml-1 border-t border-r',
    right: 'right-full top-1/2 -translate-y-1/2 -mr-1 border-b border-l',
  };

  return (
    <span className="relative inline-flex items-center">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-expanded={visible}
        aria-haspopup="true"
        aria-describedby={visible ? 'info-tooltip' : undefined}
        onClick={() => setVisible((v) => !v)}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={(e) => {
          // Don't close if focus moved to tooltip
          if (!tooltipRef.current?.contains(e.relatedTarget as Node)) {
            setVisible(false);
          }
        }}
        className="ml-1 p-1 rounded-full text-(--muted) hover:text-(--accent) hover:bg-(--accent)/10 focus:outline-none focus:ring-2 focus:ring-(--accent)/50 active:scale-95 transition-all duration-200 min-w-[28px] min-h-[28px] flex items-center justify-center"
      >
        <Info className="w-3.5 h-3.5" aria-hidden="true" />
      </button>

      {visible && (
        <div
          ref={tooltipRef}
          id="info-tooltip"
          role="tooltip"
          className={`absolute z-50 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-(--border-hi) bg-(--surface) p-3 text-xs leading-relaxed text-(--text) shadow-xl animate-in fade-in zoom-in-95 duration-200 ${positionClasses[actualPosition]}`}
        >
          {content}
          <div
            className={`absolute w-2 h-2 bg-(--surface) border-(--border-hi) transform rotate-45 ${arrowClasses[actualPosition]}`}
            aria-hidden="true"
          />
        </div>
      )}
    </span>
  );
};
