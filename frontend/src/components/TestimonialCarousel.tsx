import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { TestimonialCard, TestimonialData } from './TestimonialCard';
import { StandardIcon } from './common/Icon';

// eslint-disable-next-line react-refresh/only-export-components
export const DEFAULT_TESTIMONIALS: TestimonialData[] = [
  {
    id: 'kippa',
    author: 'Amina Diallo',
    role: 'Head of People Operations',
    company: 'Kippa Labs',
    avatarInitials: 'AD',
    avatarBg: 'bg-accent/10 text-accent',
    quote:
      'PayD eliminated the three-day waiting period for our cross-border engineering team. Payouts that used to take endless email chains and bank tracing now clear in Stellar USDC in under 5 seconds with zero manual reconciliation.',
    metric: {
      value: '< 5 sec',
      label: 'Settlement Speed',
    },
    rating: 5,
  },
  {
    id: 'afripay',
    author: 'Kofi Mensah',
    role: 'VP of Finance & Treasury',
    company: 'AfriPay Global',
    avatarInitials: 'KM',
    avatarBg: 'bg-accent2/10 text-accent2',
    quote:
      'The automated Soroban escrow and built-in tax calculation gave our compliance auditors complete confidence. Our monthly payroll operations went from a 3-person firefighting drill to a single-click batch approval.',
    metric: {
      value: '85%',
      label: 'Admin Time Saved',
    },
    rating: 5,
  },
  {
    id: 'helios',
    author: 'Elena Rostova',
    role: 'Director of Global Operations',
    company: 'Helios Remote',
    avatarInitials: 'ER',
    avatarBg: 'bg-accent3/10 text-accent3',
    quote:
      'Managing contractor payouts across 14 countries was our biggest bottleneck. PayD’s transparent fee estimation and verifiable on-chain receipts have set a new benchmark for trust with our distributed workforce.',
    metric: {
      value: '14 Countries',
      label: 'Instant Multi-Currency',
    },
    rating: 5,
  },
];

export interface TestimonialCarouselProps {
  testimonials?: TestimonialData[];
  className?: string;
  autoPlayInterval?: number;
}

export const TestimonialCarousel: React.FC<TestimonialCarouselProps> = ({
  testimonials = DEFAULT_TESTIMONIALS,
  className = '',
  autoPlayInterval = 6000,
}) => {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartXRef = useRef<number | null>(null);

  const total = testimonials.length;

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % total);
  }, [total]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  // Keyboard navigation when carousel container is focused
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextSlide();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prevSlide();
    }
  };

  // Touch swipe support
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const diff = touchStartXRef.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    }
    touchStartXRef.current = null;
  };

  // Autoplay timer
  useEffect(() => {
    if (!isPlaying || total <= 1) return;
    const timer = setInterval(() => {
      nextSlide();
    }, autoPlayInterval);

    return () => clearInterval(timer);
  }, [isPlaying, total, autoPlayInterval, nextSlide]);

  const activeTestimonial = testimonials[currentIndex];

  return (
    <section
      className={`relative w-full py-12 sm:py-16 lg:py-20 ${className}`}
      aria-roledescription="carousel"
      aria-label={t('home.testimonialsCarouselLabel', 'Customer and partner testimonials')}
      role="region"
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsPlaying(false)}
      onMouseLeave={() => setIsPlaying(true)}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10 sm:mb-12">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-hi px-3.5 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              <StandardIcon.Quote size="xs" />
              <span>{t('home.testimonialsEyebrow', 'Proven In Production')}</span>
            </div>
            <h2 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-text">
              {t('home.testimonialsTitle', 'Trusted by global teams on Stellar')}
            </h2>
            <p className="mt-2 text-sm sm:text-base text-muted max-w-2xl">
              {t(
                'home.testimonialsSubtitle',
                'Read how enterprises and fast-growing startups leverage PayD for instant, verifiable payroll orchestration.'
              )}
            </p>
          </div>

          {/* Controls: Previous / Next & Play/Pause */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPlaying((p) => !p)}
              aria-label={
                isPlaying
                  ? t('home.pauseTestimonials', 'Pause testimonial rotation')
                  : t('home.playTestimonials', 'Resume testimonial rotation')
              }
              aria-pressed={!isPlaying}
              className="h-10 w-10 flex items-center justify-center rounded-full border border-border bg-surface text-muted hover:text-text hover:border-border-hi transition-colors focus-visible:outline-2 focus-visible:outline-accent"
            >
              {isPlaying ? <StandardIcon.Pause size="sm" /> : <StandardIcon.Play size="sm" />}
            </button>

            <button
              type="button"
              onClick={prevSlide}
              aria-label={t('home.previousTestimonial', 'Previous testimonial')}
              className="h-10 w-10 flex items-center justify-center rounded-full border border-border bg-surface text-muted hover:text-text hover:border-border-hi transition-colors focus-visible:outline-2 focus-visible:outline-accent"
            >
              <StandardIcon.ChevronLeft size="md" />
            </button>

            <button
              type="button"
              onClick={nextSlide}
              aria-label={t('home.nextTestimonial', 'Next testimonial')}
              className="h-10 w-10 flex items-center justify-center rounded-full border border-border bg-surface text-muted hover:text-text hover:border-border-hi transition-colors focus-visible:outline-2 focus-visible:outline-accent"
            >
              <StandardIcon.ChevronRight size="md" />
            </button>
          </div>
        </div>

        {/* Carousel Slide Container */}
        <div
          ref={containerRef}
          tabIndex={0}
          aria-label={t('home.testimonialsSlideTrack', 'Use left and right arrow keys to navigate testimonials')}
          className="outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-3xl"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Active Testimonial Card */}
          <div
            role="group"
            aria-roledescription="slide"
            aria-label={`${currentIndex + 1} of ${total}: ${activeTestimonial.author} from ${activeTestimonial.company}`}
            className="w-full"
          >
            <TestimonialCard testimonial={activeTestimonial} />
          </div>
        </div>

        {/* Indicator Dots */}
        <div
          className="flex items-center justify-center gap-2 mt-8"
          role="tablist"
          aria-label={t('home.testimonialIndicatorList', 'Select testimonial slide')}
        >
          {testimonials.map((item, idx) => {
            const isActive = idx === currentIndex;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`${t('home.goToSlide', 'Go to testimonial')} ${idx + 1}: ${item.author}`}
                onClick={() => goToSlide(idx)}
                className={`h-2.5 rounded-full transition-all duration-300 focus-visible:outline-2 focus-visible:outline-accent ${
                  isActive ? 'w-8 bg-accent' : 'w-2.5 bg-border-hi hover:bg-muted'
                }`}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default TestimonialCarousel;
