import React from 'react';

export interface ProgressBarProps {
  /**
   * Progress value from 0 to 100
   */
  value: number;
  /**
   * Whether to show percentage text
   */
  showLabel?: boolean;
  /**
   * Color variant
   */
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  /**
   * Size variant
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Whether to show animated gradient
   */
  animated?: boolean;
  /**
   * Additional CSS classes
   */
  className?: string;
  /**
   * ARIA label for accessibility
   */
  ariaLabel?: string;
}

const variantStyles = {
  success: 'bg-gradient-to-r from-green-500 to-emerald-400',
  warning: 'bg-gradient-to-r from-amber-500 to-orange-400',
  error: 'bg-gradient-to-r from-red-500 to-pink-400',
  info: 'bg-gradient-to-r from-blue-500 to-cyan-400',
  neutral: 'bg-gradient-to-r from-gray-500 to-slate-400',
};

const sizeStyles = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  showLabel = false,
  variant = 'info',
  size = 'md',
  animated = true,
  className = '',
  ariaLabel,
}) => {
  const clampedValue = Math.min(Math.max(value, 0), 100);
  const isComplete = clampedValue === 100;

  return (
    <div
      className={`w-full ${className}`}
      role="progressbar"
      aria-valuenow={clampedValue}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel || `Progress: ${clampedValue}%`}
    >
      {showLabel && (
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--text)]">Progress</span>
          <span className="text-sm font-semibold text-[var(--accent)]">{clampedValue}%</span>
        </div>
      )}

      <div
        className={`w-full overflow-hidden rounded-full bg-[var(--surface)] ${sizeStyles[size]}`}
      >
        <div
          className={`h-full transition-all duration-500 ease-out ${variantStyles[variant]} ${
            animated && !isComplete ? 'animate-pulse' : ''
          }`}
          style={{
            width: `${clampedValue}%`,
          }}
        />
      </div>

      {isComplete && (
        <div className="mt-2 text-xs font-medium text-green-400 flex items-center gap-1">
          <span>✓ Complete</span>
        </div>
      )}
    </div>
  );
};
