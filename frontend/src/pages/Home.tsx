import { Icon } from '@stellar/design-system';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface DashboardWidgetData {
  payments: {
    label: string;
    description: string;
  };
  roster: {
    label: string;
    description: string;
  };
  controls: {
    label: string;
    description: string;
  };
  routing: {
    label: string;
    description: string;
  };
}

function DashboardWidgetSkeleton({ variant }: { variant: 'card' | 'grid' }) {
  const reduceMotion = useReducedMotion();
  
  if (variant === 'card') {
    return (
      <div className="rounded-2xl border border-hi bg-black/10 p-4 animate-pulse" aria-hidden="true">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-surface-hi p-2.5" />
          <div>
            <div className="h-3 w-24 bg-surface-hi rounded" />
            <div className="mt-1 h-3.5 w-36 bg-surface-hi rounded" />
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="glass noise rounded-2xl border border-hi px-4 py-3 text-left animate-pulse" aria-hidden="true">
      <div className="h-2.5 w-24 bg-surface-hi rounded" />
      <div className="mt-2 h-3.5 w-32 bg-surface-hi rounded" />
    </div>
  );
}

function HighlightCardSkeleton() {
  const reduceMotion = useReducedMotion();
  
  return (
    <div className="card glass noise rounded-[1.75rem] animate-pulse" aria-hidden="true">
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-hi bg-surface-hi" />
      <div className="h-6 w-48 bg-surface-hi rounded mb-3" />
      <div className="h-4 w-64 bg-surface-hi rounded" />
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [widgetData, setWidgetData] = useState<DashboardWidgetData | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const timer = setTimeout(() => {
      setWidgetData({
        payments: {
          label: 'Payments',
          description: 'Single-transaction flow',
        },
        roster: {
          label: 'Roster',
          description: 'Keep employee data current',
        },
        controls: {
          label: 'Controls',
          description: 'Audit-ready by default',
        },
        routing: {
          label: 'Routing',
          description: 'No switching friction',
        },
      });
      setIsLoading(false);
    }, reduceMotion ? 0 : 800);

    return () => clearTimeout(timer);
  }, [reduceMotion]);

  return (
    <main className="flex min-h-[80vh] flex-col px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-10">
        <section
          className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]"
          aria-labelledby="home-hero-title"
        >
          <div className="space-y-8 text-center lg:text-left">
            <div className="mx-auto flex w-fit items-center gap-3 rounded-full border border-hi bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-muted lg:mx-0">
              <span id="tour-welcome" className="relative flex h-8 w-8 items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-accent/10 blur-md" />
                <Icon.Rocket01 size="sm" className="relative z-10 text-accent" />
              </span>
              Live payroll orchestration
            </div>

            <div className="space-y-5">
              <h1
                id="home-hero-title"
                className="text-4xl font-black leading-tight tracking-tighter sm:text-5xl lg:text-6xl"
              >
                {t('home.titleLine1Prefix')}{' '}
                <span className="text-accent">{t('home.titleLine1Highlight')}</span>
                <br />
                {t('home.titleLine2Prefix')}{' '}
                <span className="text-accent2">{t('home.titleLine2Highlight')}</span>
                {t('home.titleLine2Suffix')}
              </h1>

              <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted sm:text-xl lg:mx-0">
                {t('home.tagline')}
              </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center lg:justify-start">
              <button
                type="button"
                aria-label={t('home.ctaManagePayroll')}
                className="w-full rounded-xl bg-accent px-8 py-4 font-bold text-bg shadow-lg shadow-accent/20 transition-transform hover:scale-[1.02] sm:w-auto"
                onClick={() => {
                  void navigate('/payroll');
                }}
              >
                {t('home.ctaManagePayroll')}
              </button>
              <button
                type="button"
                aria-label={t('home.ctaViewEmployees')}
                className="w-full rounded-xl border border-hi px-8 py-4 font-bold text-text transition-all hover:border-accent/50 hover:bg-white/5 sm:w-auto"
                onClick={() => {
                  void navigate('/employee');
                }}
              >
                {t('home.ctaViewEmployees')}
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3" role="region" aria-label="Quick features">
              {isLoading ? (
                <>
                  <DashboardWidgetSkeleton variant="grid" />
                  <DashboardWidgetSkeleton variant="grid" />
                  <DashboardWidgetSkeleton variant="grid" />
                </>
              ) : (
                <>
                  <div className="glass noise rounded-2xl border border-hi px-4 py-3 text-left">
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted">
                      Payroll control
                    </p>
                    <p className="mt-2 text-sm font-semibold text-text">Schedule, approve, ship.</p>
                  </div>
                  <div className="glass noise rounded-2xl border border-hi px-4 py-3 text-left">
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted">
                      Employee ops
                    </p>
                    <p className="mt-2 text-sm font-semibold text-text">
                      Onboard without context loss.
                    </p>
                  </div>
                  <div className="glass noise rounded-2xl border border-hi px-4 py-3 text-left">
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted">
                      Secure delivery
                    </p>
                    <p className="mt-2 text-sm font-semibold text-text">Trace every payout event.</p>
                  </div>
                </>
              )}
            </div>
          </div>

          <aside className="relative overflow-hidden rounded-[2rem] border border-hi bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] p-6 shadow-2xl shadow-black/20" role="region" aria-label="Workspace snapshot">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(74,240,184,0.16),transparent_42%),radial-gradient(circle_at_bottom_left,rgba(124,111,247,0.14),transparent_40%)]" />
            <div className="relative space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted">
                    Workspace snapshot
                  </p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-text">
                    Ready to ship payroll
                  </h2>
                </div>
                <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
                  Live
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2" role="list" aria-label="Dashboard metrics">
                {isLoading ? (
                  <>
                    <DashboardWidgetSkeleton variant="card" />
                    <DashboardWidgetSkeleton variant="card" />
                    <DashboardWidgetSkeleton variant="card" />
                    <DashboardWidgetSkeleton variant="card" />
                  </>
                ) : widgetData ? (
                  <>
                    <div className="rounded-2xl border border-hi bg-black/10 p-4" role="listitem">
                      <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-accent/10 p-2.5">
                          <Icon.CreditCard01 size="md" className="text-accent" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted">
                            {widgetData.payments.label}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-text">
                            {widgetData.payments.description}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-hi bg-black/10 p-4" role="listitem">
                      <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-accent2/10 p-2.5">
                          <Icon.Users01 size="md" className="text-accent2" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted">
                            {widgetData.roster.label}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-text">
                            {widgetData.roster.description}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-hi bg-black/10 p-4" role="listitem">
                      <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-danger/10 p-2.5">
                          <Icon.ShieldTick size="md" className="text-danger" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted">
                            {widgetData.controls.label}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-text">{widgetData.controls.description}</p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-hi bg-black/10 p-4" role="listitem">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[11px] font-black uppercase tracking-[0.24em] text-muted">
                          Flow
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted">
                            {widgetData.routing.label}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-text">{widgetData.routing.description}</p>
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </aside>
        </section>

        <section
          className="grid grid-cols-1 gap-6 text-left sm:grid-cols-2 lg:grid-cols-3"
          aria-label="Payroll platform highlights"
        >
          {isLoading ? (
            <>
              <HighlightCardSkeleton />
              <HighlightCardSkeleton />
              <HighlightCardSkeleton />
            </>
          ) : (
            <>
              <div className="card glass noise rounded-[1.75rem] motion-route-in">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10">
                  <Icon.CreditCard01 size="lg" className="text-accent" />
                </div>
                <h3 className="mb-3 text-xl font-bold">{t('home.card1Title')}</h3>
                <p className="text-sm leading-relaxed text-muted">{t('home.card1Body')}</p>
              </div>

              <div className="card glass noise rounded-[1.75rem] motion-route-in" style={{ animationDelay: '80ms' }}>
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-accent2/20 bg-accent2/10">
                  <Icon.Users01 size="lg" className="text-accent2" />
                </div>
                <h3 className="mb-3 text-xl font-bold">{t('home.card2Title')}</h3>
                <p className="text-sm leading-relaxed text-muted">{t('home.card2Body')}</p>
              </div>

              <div className="card glass noise rounded-[1.75rem] motion-route-in" style={{ animationDelay: '160ms' }}>
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-danger/20 bg-danger/10">
                  <Icon.ShieldTick size="lg" className="text-danger" />
                </div>
                <h3 className="mb-3 text-xl font-bold">{t('home.card3Title')}</h3>
                <p className="text-sm leading-relaxed text-muted">{t('home.card3Body')}</p>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
