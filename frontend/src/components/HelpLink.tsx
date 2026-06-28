import { Link } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';

interface HelpLinkProps {
  topic?: string;
  section?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'icon' | 'text' | 'icon-text';
}

const sizeClasses = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

const textSizeClasses = {
  sm: 'text-[10px]',
  md: 'text-xs',
  lg: 'text-sm',
};

const minSizeClasses = {
  sm: 'min-w-[32px] min-h-[32px]',
  md: 'min-w-[36px] min-h-[36px]',
  lg: 'min-w-[44px] min-h-[44px]',
};

export function HelpLink({
  topic,
  section,
  className = '',
  size = 'md',
  variant = 'icon',
}: HelpLinkProps) {
  const helpPath = topic
    ? `/help?q=${encodeURIComponent(topic)}`
    : section
      ? `/help#${section}`
      : '/help';

  const baseClasses =
    'inline-flex items-center justify-center gap-1.5 text-(--muted) hover:text-(--accent) hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-(--accent)/50 rounded-lg transition-all duration-200';

  const ariaLabel = topic
    ? `Get help with ${topic}`
    : section
      ? `Go to help section: ${section}`
      : 'Go to help center';

  if (variant === 'icon') {
    return (
      <Link
        to={helpPath}
        className={`${baseClasses} ${minSizeClasses[size]} p-1 ${className}`}
        title={ariaLabel}
        aria-label={ariaLabel}
      >
        <HelpCircle className={sizeClasses[size]} aria-hidden="true" />
      </Link>
    );
  }

  if (variant === 'text') {
    return (
      <Link
        to={helpPath}
        className={`${baseClasses} ${textSizeClasses[size]} px-2 py-1 font-medium ${className}`}
        aria-label={ariaLabel}
      >
        Help
      </Link>
    );
  }

  return (
    <Link
      to={helpPath}
      className={`${baseClasses} ${textSizeClasses[size]} px-2 py-1 font-medium ${className}`}
      aria-label={ariaLabel}
    >
      <HelpCircle className={sizeClasses[size]} aria-hidden="true" />
      <span>Help</span>
    </Link>
  );
}

interface ContextHelpProps {
  topic: string;
  className?: string;
}

export function ContextHelp({ topic, className = '' }: ContextHelpProps) {
  return (
    <Link
      to={`/help?q=${encodeURIComponent(topic)}`}
      className={`inline-flex items-center justify-center w-7 h-7 rounded-full bg-(--surface-hi) border border-(--border-hi) text-(--muted) hover:text-(--accent) hover:border-(--accent) hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-(--accent)/50 transition-all duration-200 ${className}`}
      title={`Get help with: ${topic}`}
      aria-label={`Get help with ${topic}`}
    >
      <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
    </Link>
  );
}
