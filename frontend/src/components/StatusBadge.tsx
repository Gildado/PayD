import React from 'react';
import { Check, Clock, AlertCircle, XCircle, Loader2 } from 'lucide-react';

export type StatusBadgeVariant =
  | 'success'
  | 'pending'
  | 'warning'
  | 'error'
  | 'loading'
  | 'neutral';

export interface StatusBadgeProps {
  variant: StatusBadgeVariant;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const variantStyles: Record<StatusBadgeVariant, { bg: string; text: string; border: string }> = {
  success: {
    bg: 'bg-green-500/15',
    text: 'text-green-400',
    border: 'border-green-500/30',
  },
  pending: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
  },
  warning: {
    bg: 'bg-orange-500/15',
    text: 'text-orange-400',
    border: 'border-orange-500/30',
  },
  error: {
    bg: 'bg-red-500/15',
    text: 'text-red-400',
    border: 'border-red-500/30',
  },
  loading: {
    bg: 'bg-blue-500/15',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
  },
  neutral: {
    bg: 'bg-gray-500/15',
    text: 'text-gray-400',
    border: 'border-gray-500/30',
  },
};

const sizeStyles = {
  sm: 'text-xs px-2 py-1 gap-1',
  md: 'text-sm px-2.5 py-1.5 gap-1.5',
  lg: 'text-sm px-3 py-2 gap-2',
};

const iconMap: Record<StatusBadgeVariant, React.ReactNode> = {
  success: <Check size={16} />,
  pending: <Clock size={16} />,
  warning: <AlertCircle size={16} />,
  error: <XCircle size={16} />,
  loading: <Loader2 size={16} className="animate-spin" />,
  neutral: <div className="h-4 w-4 rounded-full bg-current/50" />,
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  variant,
  label,
  size = 'md',
  className = '',
}) => {
  const styles = variantStyles[variant];
  const sizeClass = sizeStyles[size];

  return (
    <div
      className={`inline-flex items-center rounded-lg border ${styles.bg} ${styles.text} ${styles.border} ${sizeClass} ${className}`}
      role="status"
      aria-label={`Status: ${label}`}
    >
      {iconMap[variant]}
      <span className="font-medium">{label}</span>
    </div>
  );
};
