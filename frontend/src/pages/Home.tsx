import { Icon } from '@stellar/design-system';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import {
  Building2,
  Globe,
  ShieldCheck,
  CreditCard,
  Layers,
  Clock,
  PieChart,
} from 'lucide-react';
import SecurityAuditBadges from '../components/SecurityAuditBadges';
import { ArrowLink, Button } from '../components/common/Button';

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
  if (variant === 'card') {
    return (
      <div className="rounded-2xl border border-hi bg-surface-hi p-4 animate-pulse" aria-hidden="true">
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
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  const coreOfferings = [
    {
      id: 'payroll',
      title: t('home.coreOfferings.payroll.title'),
      tag: t('home.coreOfferings.payroll.tag'),
      description: t('home.coreOfferings.payroll.description'),
      linkText: t('home.coreOfferings.payroll.linkText'),
      path: '/payroll',
      icon: <CreditCard className="h-6 w-6 text-accent" aria-hidden="true" />,
      iconBg: 'border-accent/20 bg-accent/10',
    },
    {
      id: 'bulk-payments',
      title: t('home.coreOfferings.bulkPayments.title'),
      tag: t('home.coreOfferings.bulkPayments.tag'),
      description: t('home.coreOfferings.bulkPayments.description'),
      linkText: t('home.coreOfferings.bulkPayments.linkText'),
      path: '/bulk-upload',
      icon: <Layers className="h-6 w-6 text-accent2" aria-hidden="true" />,
      iconBg: 'border-accent2/20 bg-accent2/10',
    },
    {
      id: 'escrow',
      title: t('home.coreOfferings.escrow.title'),
      tag: t('home.coreOfferings.escrow.tag'),
      description: t('home.coreOfferings.escrow.description'),
      linkText: t('home.coreOfferings.escrow.linkText'),
      path: '/employer/vesting',
      icon: <ShieldCheck className="h-6 w-6 text-accent3" aria-hidden="true" />,
      iconBg: 'border-accent3/20 bg-accent3/10',
    },
    {
      id: 'vesting',
      title: t('home.coreOfferings.vesting.title'),
      tag: t('home.coreOfferings.vesting.tag'),
      description: t('home.coreOfferings.vesting.description'),
      linkText: t('home.coreOfferings.vesting.linkText'),
      path: '/employer/vesting',
      icon: <Clock className="h-6 w-6 text-accent" aria-hidden="true" />,
      iconBg: 'border-accent/20 bg-accent/10',
    },
    {
      id: 'revenue-split',
      title: t('home.coreOfferings.revenueSplit.title'),
      tag: t('home.coreOfferings.revenueSplit.tag'),
      description: t('home.coreOfferings.revenueSplit.description'),
      linkText: t('home.coreOfferings.revenueSplit.linkText'),
      path: '/revenue-split',
      icon: <PieChart className="h-6 w-6 text-accent2" aria-hidden="true" />,
      iconBg: 'border-accent2/20 bg-accent2/10',
    },
  ];

  return (
    <main className="relative flex min-h-[80vh] flex-col overflow-hidden px-4 py-10 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[32rem] bg-[radial-gradient(circle_at_15%_0%,color-mix(in_srgb,var(--accent3)_13%,transparent),transparent_42%),radial-gradient(circle_at_85%_10%,color-mix(in_srgb,var(--accent2)_12%,transparent),transparent_38%)]" />
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col gap-16 lg:gap-24">
        <section
          className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]"
          aria-labelledby="home-hero-title"
        >
          <div className="space-y-8 text-center lg:text-left">
            <div className="mx-auto flex w-fit items-center gap-3 rounded-full border border-hi bg-surface-hi px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-muted lg:mx-0">
              <span id="tour-welcome" className="relative flex h-8 w-8 items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-accent/10 blur-md" />
                <Icon.Rocket01 size="sm" className="relative z-10 text-accent" />
              </span>
              Live payroll orchestration
            </div>

            <div className="space-y-5">
              <h1
                id="home-hero-title"
                className="max-w-3xl text-4xl font-extrabold leading-[1.04] tracking-[-0.04em] sm:text-5xl lg:text-7xl"
              >
                {t('home.titleLine1Prefix')}{' '}
                <span className="text-accent">{t('home.titleLine1Highlight')}</span>
                <br />
                {t('home.titleLine2Prefix')}{' '}
                <span className="text-accent3">{t('home.titleLine2Highlight')}</span>
                {t('home.titleLine2Suffix')}
              </h1>

              <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted sm:text-xl lg:mx-0">
                {t('home.tagline')}
              </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center lg:justify-start">
              <Button
                size="lg"
                aria-label={t('home.ctaManagePayroll')}
                className="w-full sm:w-auto"
                onClick={() => {
                  void navigate('/payroll');
                }}
              >
                {t('home.ctaManagePayroll')}
              </Button>
              <Button
                variant="secondary"
                size="lg"
                aria-label={t('home.ctaViewEmployees')}
                className="w-full sm:w-auto"
                onClick={() => {
                  void navigate('/employee');
                }}
              >
                {t('home.ctaViewEmployees')}
              </Button>
            </div>

            <div
              className="grid grid-cols-3 gap-3 border-y border-hi py-5 text-left"
              role="region"
              aria-label="Trust signals"
            >
              <div>
                <p className="text-xl font-extrabold tracking-tight text-text sm:text-2xl">
                  {t('home.statSettlement')}
                </p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted sm:text-xs">
                  {t('home.statSettlementLabel')}
                </p>
              </div>
              <div className="border-l border-hi pl-3">
                <p className="text-xl font-extrabold tracking-tight text-text sm:text-2xl">
                  {t('home.statAvailability')}
                </p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted sm:text-xs">
                  {t('home.statAvailabilityLabel')}
                </p>
              </div>
              <div className="border-l border-hi pl-3">
                <p className="text-xl font-extrabold tracking-tight text-text sm:text-2xl">
                  {t('home.statNetwork')}
                </p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted sm:text-xs">
                  {t('home.statNetworkLabel')}
                </p>
              </div>
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

          <aside className="relative overflow-hidden rounded-[2rem] border border-hi bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] p-6 shadow-[var(--shadow-lg)]" role="region" aria-label="Workspace snapshot">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--accent3)_12%,transparent),transparent_42%),radial-gradient(circle_at_bottom_left,color-mix(in_srgb,var(--accent2)_10%,transparent),transparent_40%)]" />
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
                    <div className="rounded-2xl border border-hi bg-surface-hi p-4" role="listitem">
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
                    <div className="rounded-2xl border border-hi bg-surface-hi p-4" role="listitem">
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
                    <div className="rounded-2xl border border-hi bg-surface-hi p-4" role="listitem">
                      <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-accent3/10 p-2.5">
                          <Icon.ShieldTick size="md" className="text-accent3" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted">
                            {widgetData.controls.label}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-text">{widgetData.controls.description}</p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-hi bg-surface-hi p-4" role="listitem">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-hi bg-surface text-[11px] font-black uppercase tracking-[0.24em] text-muted">
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

        {/* Key Stats Bar under Hero (myworkpay-inspired country/company counters) */}
        <section
          className="relative overflow-hidden rounded-[2rem] border border-hi bg-surface p-6 sm:p-8 lg:p-10 shadow-card"
          role="region"
          aria-label={t('home.statsBar.ariaLabel')}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-accent/5 via-transparent to-transparent" />
          <div className="relative grid grid-cols-1 divide-y divide-hi sm:grid-cols-3 sm:divide-y-0 sm:divide-x sm:divide-hi">
            <div className="flex flex-col items-center sm:items-start text-center sm:text-left py-4 sm:py-0 sm:px-6 first:pl-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <Building2 className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-muted">
                  {t('home.statsBar.organizationsLabel')}
                </span>
              </div>
              <span className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-accent">
                {t('home.statsBar.organizationsMetric')}
              </span>
              <span className="mt-1 text-xs sm:text-sm text-muted">
                {t('home.statsBar.organizationsDesc')}
              </span>
            </div>

            <div className="flex flex-col items-center sm:items-start text-center sm:text-left py-4 sm:py-0 sm:px-6">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent2/10 text-accent2">
                  <Globe className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-muted">
                  {t('home.statsBar.countriesLabel')}
                </span>
              </div>
              <span className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-accent2">
                {t('home.statsBar.countriesMetric')}
              </span>
              <span className="mt-1 text-xs sm:text-sm text-muted">
                {t('home.statsBar.countriesDesc')}
              </span>
            </div>

            <div className="flex flex-col items-center sm:items-start text-center sm:text-left py-4 sm:py-0 sm:px-6 last:pr-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent3/10 text-accent3">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-muted">
                  {t('home.statsBar.contractsLabel')}
                </span>
              </div>
              <span className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-accent3">
                {t('home.statsBar.contractsMetric')}
              </span>
              <span className="mt-1 text-xs sm:text-sm text-muted">
                {t('home.statsBar.contractsDesc')}
              </span>
            </div>
          </div>
        </section>

        {/* Core Offerings Section (myworkpay service tiles) */}
        <section
          className="space-y-8"
          role="region"
          aria-labelledby="core-offerings-heading"
        >
          <div className="max-w-2xl text-center sm:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-hi bg-surface-hi px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              {t('home.coreOfferings.eyebrow')}
            </div>
            <h2
              id="core-offerings-heading"
              className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-text"
            >
              {t('home.coreOfferings.title')}
            </h2>
            <p className="mt-2 text-base text-muted">
              {t('home.coreOfferings.subtitle')}
            </p>
          </div>

          <div
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
            role="list"
            aria-label={t('home.coreOfferings.title')}
          >
            {coreOfferings.map((offering, idx) => (
              <div
                key={offering.id}
                role="listitem"
                tabIndex={0}
                onClick={() => void navigate(offering.path)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    void navigate(offering.path);
                  }
                }}
                aria-label={`${offering.title}: ${offering.description}`}
                className="card group relative flex flex-col justify-between rounded-[1.75rem] p-6 transition-all duration-200 hover:-translate-y-1 hover:border-border-hi hover:shadow-card-hover cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <div>
                  <div className="flex items-center justify-between gap-3 mb-5">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${offering.iconBg} transition-transform duration-200 group-hover:scale-105`}
                    >
                      {offering.icon}
                    </div>
                    <span className="rounded-full border border-hi bg-surface-hi px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                      {offering.tag}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold tracking-tight text-text group-hover:text-accent transition-colors">
                    {offering.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted line-clamp-3">
                    {offering.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-hi/60">
                  <span className="link-arrow text-sm font-semibold text-accent3 group-hover:text-accent">
                    <span>{offering.linkText}</span>
                    <span className="link-arrow-icon" aria-hidden="true">→</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
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
              <div className="card flex flex-col rounded-[1.75rem] p-8 motion-route-in">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10">
                  <Icon.CreditCard01 size="lg" className="text-accent" />
                </div>
                <h3 className="mb-3 text-xl font-bold">{t('home.card1Title')}</h3>
                <p className="flex-1 text-sm leading-relaxed text-muted">{t('home.card1Body')}</p>
                <ArrowLink to="/payroll" className="mt-6 text-sm">
                  {t('home.card1Link')}
                </ArrowLink>
              </div>

              <div className="card flex flex-col rounded-[1.75rem] p-8 motion-route-in" style={{ animationDelay: '80ms' }}>
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-accent2/20 bg-accent2/10">
                  <Icon.Users01 size="lg" className="text-accent2" />
                </div>
                <h3 className="mb-3 text-xl font-bold">{t('home.card2Title')}</h3>
                <p className="flex-1 text-sm leading-relaxed text-muted">{t('home.card2Body')}</p>
                <ArrowLink to="/employee" className="mt-6 text-sm">
                  {t('home.card2Link')}
                </ArrowLink>
              </div>

              <div className="card flex flex-col rounded-[1.75rem] p-8 motion-route-in" style={{ animationDelay: '160ms' }}>
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-accent3/20 bg-accent3/10">
                  <Icon.ShieldTick size="lg" className="text-accent3" />
                </div>
                <h3 className="mb-3 text-xl font-bold">{t('home.card3Title')}</h3>
                <p className="flex-1 text-sm leading-relaxed text-muted">{t('home.card3Body')}</p>
                <ArrowLink to="/transactions" className="mt-6 text-sm">
                  {t('home.card3Link')}
                </ArrowLink>
              </div>
            </>
          )}
        </section>

        <SecurityAuditBadges />
      </div>
    </main>
  );
}
