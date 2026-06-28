import React from 'react';
import { Check, Clock, XCircle } from 'lucide-react';

export type TimelineItemStatus = 'completed' | 'current' | 'pending' | 'error';

export interface TimelineItem {
  /**
   * Unique identifier
   */
  id: string;
  /**
   * Item label/title
   */
  label: string;
  /**
   * Item description
   */
  description?: string;
  /**
   * Current status
   */
  status: TimelineItemStatus;
  /**
   * Timestamp
   */
  timestamp?: string;
}

export interface TimelineProps {
  /**
   * Array of timeline items
   */
  items: TimelineItem[];
  /**
   * Layout direction
   */
  direction?: 'vertical' | 'horizontal';
  /**
   * Additional CSS classes
   */
  className?: string;
}

const statusIcons: Record<TimelineItemStatus, React.ReactNode> = {
  completed: <Check size={20} />,
  current: <Clock size={20} />,
  pending: <div className="h-5 w-5 rounded-full border-2 border-[var(--muted)]" />,
  error: <XCircle size={20} />,
};

const statusColors: Record<TimelineItemStatus, string> = {
  completed: 'bg-green-500 text-white',
  current: 'bg-blue-500 text-white',
  pending: 'bg-[var(--surface)] text-[var(--muted)] border-2 border-[var(--border-hi)]',
  error: 'bg-red-500 text-white',
};

const statusLineColors: Record<TimelineItemStatus, string> = {
  completed: 'bg-green-500',
  current: 'bg-blue-500',
  pending: 'bg-[var(--border-hi)]',
  error: 'bg-red-500',
};

export const Timeline: React.FC<TimelineProps> = ({
  items,
  direction = 'vertical',
  className = '',
}) => {
  if (direction === 'horizontal') {
    return (
      <div className={`w-full ${className}`}>
        <div className="flex items-start gap-4 lg:gap-6 overflow-x-auto pb-4">
          {items.map((item, index) => (
            <div key={item.id} className="flex flex-col items-center min-w-max">
              <div
                className={`flex items-center justify-center h-10 w-10 rounded-full ${statusColors[item.status]} transition-colors`}
              >
                {statusIcons[item.status]}
              </div>

              {index < items.length - 1 && (
                <div
                  className={`h-1 w-12 mt-2 ${statusLineColors[item.status]} transition-colors`}
                  aria-hidden="true"
                />
              )}

              <div className="mt-3 text-center max-w-xs">
                <h4 className="text-sm font-semibold text-[var(--text)]">{item.label}</h4>
                {item.description && (
                  <p className="text-xs text-[var(--muted)] mt-1">{item.description}</p>
                )}
                {item.timestamp && (
                  <time className="text-xs text-[var(--muted)] mt-1 block">{item.timestamp}</time>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      <ol className="relative space-y-6 border-l-2 border-[var(--border-hi)] pl-6 md:pl-8">
        {items.map((item) => (
          <li key={item.id}>
            <div className="absolute -left-4 md:-left-5 mt-1.5">
              <div
                className={`flex items-center justify-center h-8 w-8 rounded-full ${statusColors[item.status]} transition-colors`}
              >
                {statusIcons[item.status]}
              </div>
            </div>

            <div>
              <h3 className="text-base font-semibold text-[var(--text)]">{item.label}</h3>

              {item.description && (
                <p className="text-sm text-[var(--muted)] mt-1">{item.description}</p>
              )}

              {item.timestamp && (
                <time className="text-sm text-[var(--muted)] mt-2 block">{item.timestamp}</time>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
};
