import React from 'react';
import { StandardIcon } from './common/Icon';

export interface TestimonialData {
  id: string;
  quote: string;
  author: string;
  role: string;
  company: string;
  avatarInitials: string;
  avatarBg?: string;
  avatarUrl?: string;
  metric?: {
    value: string;
    label: string;
  };
  rating?: number;
}

export interface TestimonialCardProps {
  testimonial: TestimonialData;
  className?: string;
  isActive?: boolean;
}

const STAR_KEYS = ['star-1', 'star-2', 'star-3', 'star-4', 'star-5'];

export const TestimonialCard: React.FC<TestimonialCardProps> = ({
  testimonial,
  className = '',
  isActive = true,
}) => {
  const {
    quote,
    author,
    role,
    company,
    avatarInitials,
    avatarBg = 'bg-accent/10 text-accent',
    avatarUrl,
    metric,
    rating = 5,
  } = testimonial;

  return (
    <article
      className={`testimonial-card p-6 sm:p-8 lg:p-10 ${className}`}
      aria-hidden={!isActive}
    >
      {/* Decorative top accent glow */}
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-accent2/10 blur-2xl"
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col justify-between h-full gap-6">
        {/* Header: Stars & Metric Badge */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-1" aria-label={`Rating: ${rating} out of 5 stars`}>
            {STAR_KEYS.map((starKey, i) => (
              <StandardIcon.Star
                key={starKey}
                size="sm"
                className={i < rating ? 'text-[#f59e0b] fill-[#f59e0b]' : 'text-border'}
              />
            ))}
          </div>

          {metric && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-accent2/30 bg-accent2/10 text-accent2 text-xs font-bold">
              <span>{metric.value}</span>
              <span className="font-normal text-[11px] text-muted">· {metric.label}</span>
            </div>
          )}
        </div>

        {/* Quote body */}
        <blockquote className="my-2">
          <div className="mb-3 text-accent2/60" aria-hidden="true">
            <StandardIcon.Quote size="lg" />
          </div>
          <p className="text-base sm:text-lg lg:text-xl font-medium leading-relaxed text-text">
            &ldquo;{quote}&rdquo;
          </p>
        </blockquote>

        {/* Author info */}
        <div className="flex items-center gap-3.5 pt-4 border-t border-border/80">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={author}
              className="h-12 w-12 rounded-full object-cover border-2 border-border-hi"
            />
          ) : (
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-bold text-sm border border-border-hi ${avatarBg}`}
              aria-hidden="true"
            >
              {avatarInitials}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="font-bold text-sm sm:text-base text-text truncate">{author}</h4>
              <span
                className="inline-flex items-center text-accent2"
                title="Verified Customer"
                aria-label="Verified Customer"
              >
                <StandardIcon.CheckCircle size="xs" />
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted truncate">
              {role} · <span className="font-semibold text-text">{company}</span>
            </p>
          </div>
        </div>
      </div>
    </article>
  );
};

export default TestimonialCard;
