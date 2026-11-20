import React, { useState } from 'react';
import { Check, X, Sparkles, Shield, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ArrowAnchor } from './common/Button';

export type BillingCycle = 'monthly' | 'annual';

export interface PlanTier {
  id: string;
  name: string;
  tagline: string;
  badge?: string;
  isPopular?: boolean;
  priceMonthly: string;
  priceAnnual: string;
  periodMonthly: string;
  periodAnnual: string;
  ctaText: string;
  ctaHref?: string;
  onSelect?: () => void;
  secondaryLinkText?: string;
  secondaryLinkHref?: string;
  onSecondaryLinkClick?: () => void;
  highlightColor?: string;
}

export interface FeatureItem {
  id: string;
  name: string;
  description?: string;
  /** Values per plan id: boolean (checkmark/cross) or custom string */
  values: Record<string, boolean | string>;
}

export interface FeatureCategory {
  id: string;
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  features: FeatureItem[];
}

export interface PlanComparisonTableProps {
  title?: string;
  subtitle?: string;
  plans?: PlanTier[];
  categories?: FeatureCategory[];
  defaultBillingCycle?: BillingCycle;
  onPlanSelect?: (planId: string, cycle: BillingCycle) => void;
  className?: string;
}

const DEFAULT_PLANS: PlanTier[] = [
  {
    id: 'self-serve',
    name: 'Self-Serve',
    tagline: 'Ideal for early-stage teams & DAO contributors running automated crypto payroll.',
    priceMonthly: '$0',
    priceAnnual: '$0',
    periodMonthly: 'free forever + 0.15% fee',
    periodAnnual: 'free forever + 0.15% fee',
    ctaText: 'Get Started Free',
    secondaryLinkText: 'Explore self-serve features',
    secondaryLinkHref: '#self-serve-details',
  },
  {
    id: 'managed',
    name: 'Managed Payroll',
    tagline:
      'End-to-end automated workforce disbursals with compliance, cross-asset swaps & monitoring.',
    badge: 'Most Popular',
    isPopular: true,
    priceMonthly: '$49',
    priceAnnual: '$39',
    periodMonthly: 'per month + standard network gas',
    periodAnnual: 'per month, billed annually',
    ctaText: 'Start 14-Day Free Trial',
    secondaryLinkText: 'Schedule a live walkthrough',
    secondaryLinkHref: '#managed-walkthrough',
  },
  {
    id: 'enterprise',
    name: 'Enterprise Treasury',
    tagline:
      'Custom smart contract governance, multi-sig signer workflows & bespoke compliance SLAs.',
    badge: 'Custom Treasury',
    priceMonthly: 'Custom',
    priceAnnual: 'Custom',
    periodMonthly: 'tailored to organizational volume',
    periodAnnual: 'tailored to organizational volume',
    ctaText: 'Contact Enterprise Sales',
    secondaryLinkText: 'Talk to a treasury architect',
    secondaryLinkHref: '#enterprise-contact',
  },
];

const DEFAULT_CATEGORIES: FeatureCategory[] = [
  {
    id: 'automation',
    title: 'Payroll Automation & Distribution',
    icon: Zap,
    features: [
      {
        id: 'recipients',
        name: 'Supported Recipients',
        description: 'Maximum active employees or contractors per payout cycle',
        values: {
          'self-serve': 'Up to 25',
          managed: 'Up to 250',
          enterprise: 'Unlimited',
        },
      },
      {
        id: 'cadences',
        name: 'Recurring Cadences',
        description: 'Weekly, bi-weekly, monthly, or customized schedule runs',
        values: {
          'self-serve': 'Weekly & Monthly',
          managed: 'Weekly, Bi-weekly & Monthly',
          enterprise: 'Custom cron & on-demand',
        },
      },
      {
        id: 'escrow',
        name: 'Automated Smart Escrow',
        description: 'Trustless funds holding with Soroban claimable balances',
        values: {
          'self-serve': true,
          managed: true,
          enterprise: true,
        },
      },
      {
        id: 'cross-asset',
        name: 'Cross-Asset Settlements',
        description: 'Automatic DEX routing (e.g. USDC to XLM, EURC, or local stablecoins)',
        values: {
          'self-serve': 'Standard pairs',
          managed: 'All Stellar DEX pairs',
          enterprise: 'Private liquidity pools & customized routing',
        },
      },
      {
        id: 'sponsored-gas',
        name: 'Sponsored / Gasless Transactions',
        description: 'Company-sponsored network fees so employees pay 0 gas to claim',
        values: {
          'self-serve': false,
          managed: true,
          enterprise: true,
        },
      },
      {
        id: 'bulk-csv',
        name: 'CSV Drag & Drop Uploader',
        description: 'RFC-4180 validated batch file upload with inline error fixes',
        values: {
          'self-serve': true,
          managed: true,
          enterprise: true,
        },
      },
    ],
  },
  {
    id: 'security',
    title: 'Governance & Security Compliance',
    icon: Shield,
    features: [
      {
        id: 'multisig',
        name: 'Multi-Sig Approval Workflows',
        description: 'M-of-N signature quorum before batch releases funds from vault',
        values: {
          'self-serve': false,
          managed: 'Up to 3 signers',
          enterprise: 'Unlimited signer hierarchy',
        },
      },
      {
        id: 'rbac',
        name: 'Role-Based Access Control',
        description: 'Granular permissions for finance admins, auditors, and viewers',
        values: {
          'self-serve': 'Admin only',
          managed: 'Admin & Viewer',
          enterprise: 'Granular RBAC with audit trails',
        },
      },
      {
        id: 'tax',
        name: 'Tax & Withholding Calculation',
        description: 'Real-time multi-jurisdiction tax estimation and reporting reports',
        values: {
          'self-serve': 'Basic exports',
          managed: 'Automated breakdown reports',
          enterprise: 'Custom payroll tax integrations',
        },
      },
      {
        id: 'audit-logs',
        name: 'Immutable Audit Logs',
        description: 'Tamper-evident logs of all contract interactions and disbursements',
        values: {
          'self-serve': '30-day history',
          managed: '1-year history',
          enterprise: 'Perpetual on-chain archive',
        },
      },
    ],
  },
  {
    id: 'support',
    title: 'Support & Infrastructure SLAs',
    icon: Sparkles,
    features: [
      {
        id: 'portal',
        name: 'Employee Self-Service Portal',
        description: 'Dedicated portal for staff to view paystubs and connect wallets',
        values: {
          'self-serve': true,
          managed: true,
          enterprise: true,
        },
      },
      {
        id: 'api-webhooks',
        name: 'REST API & Webhook Dispatch',
        description: 'Event webhooks for ERP, HRIS, and accounting system sync',
        values: {
          'self-serve': 'Community API rate limits',
          managed: 'Standard Webhooks (10 req/s)',
          enterprise: 'High-throughput dedicated webhooks',
        },
      },
      {
        id: 'sla',
        name: 'Guaranteed Uptime & Support',
        description: 'Dedicated assistance and response time SLAs',
        values: {
          'self-serve': 'Community & Docs',
          managed: 'Priority Email & Discord (< 4 hrs)',
          enterprise: '24/7 Dedicated Account Manager & 99.95% SLA',
        },
      },
    ],
  },
];

export function PlanComparisonTable({
  title = 'Flexible Plans Designed for Scalable Workforce Payroll',
  subtitle = 'Whether running automated payroll for a lean startup or governing enterprise multi-sig vaults on Stellar mainnet, choose the tier that matches your workforce.',
  plans = DEFAULT_PLANS,
  categories = DEFAULT_CATEGORIES,
  defaultBillingCycle = 'annual',
  onPlanSelect,
  className = '',
}: PlanComparisonTableProps) {
  const { t } = useTranslation();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(defaultBillingCycle);
  const [selectedMobileTier, setSelectedMobileTier] = useState<string>(
    plans[1]?.id ?? plans[0]?.id ?? 'managed'
  );

  const handleSelect = (plan: PlanTier) => {
    if (plan.onSelect) {
      plan.onSelect();
    } else if (onPlanSelect) {
      onPlanSelect(plan.id, billingCycle);
    }
  };

  const activeMobilePlan = plans.find((p) => p.id === selectedMobileTier) ?? plans[0];

  return (
    <section
      aria-labelledby="comparison-table-heading"
      className={`w-full py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto ${className}`}
    >
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide uppercase bg-(--accent2)/10 text-(--accent2) border border-(--accent2)/20 mb-4">
          <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{t('comparison.badge', 'Transparent Mainnet Pricing')}</span>
        </div>
        <h2
          id="comparison-table-heading"
          className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-(--text) font-[var(--font-head)] mb-4"
        >
          {title}
        </h2>
        <p className="text-base sm:text-lg text-(--muted) font-normal leading-relaxed">
          {subtitle}
        </p>

        {/* Billing Cycle Toggle */}
        <div
          aria-label={t('comparison.billingCycle', 'Billing Cycle')}
          className="mt-8 inline-flex items-center p-1.5 rounded-full bg-(--surface-hi) border border-(--border-hi) shadow-inner"
        >
          <button
            type="button"
            aria-pressed={billingCycle === 'monthly'}
            onClick={() => setBillingCycle('monthly')}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                setBillingCycle('annual');
              }
            }}
            className={`px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent) ${
              billingCycle === 'monthly'
                ? 'bg-(--accent) text-(--on-accent) shadow-sm'
                : 'text-(--muted) hover:text-(--text)'
            }`}
          >
            {t('comparison.monthly', 'Monthly Billing')}
          </button>
          <button
            type="button"
            aria-pressed={billingCycle === 'annual'}
            onClick={() => setBillingCycle('annual')}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                setBillingCycle('monthly');
              }
            }}
            className={`px-5 py-2 rounded-full text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent) ${
              billingCycle === 'annual'
                ? 'bg-(--accent) text-(--on-accent) shadow-sm'
                : 'text-(--muted) hover:text-(--text)'
            }`}
          >
            <span>{t('comparison.annual', 'Annual Billing')}</span>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                billingCycle === 'annual'
                  ? 'bg-white/20 text-white'
                  : 'bg-(--accent2)/15 text-(--accent2)'
              }`}
            >
              {t('comparison.savePercent', 'Save 20%')}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Tier Selector (visible on mobile < 1024px) */}
      <div className="lg:hidden mb-8">
        <label
          htmlFor="mobile-tier-select"
          className="block text-xs font-bold uppercase tracking-wider text-(--muted) mb-2"
        >
          {t('comparison.selectTier', 'Select Tier to Compare')}
        </label>
        <div
          aria-label={t('comparison.selectTier', 'Select Tier to Compare')}
          className="grid grid-cols-3 gap-2 p-1.5 rounded-xl bg-(--surface-hi) border border-(--border-hi)"
        >
          {plans.map((p, idx) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={selectedMobileTier === p.id}
              onClick={() => setSelectedMobileTier(p.id)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  const nextPlan = plans[(idx + 1) % plans.length];
                  if (nextPlan) setSelectedMobileTier(nextPlan.id);
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  const prevPlan = plans[(idx - 1 + plans.length) % plans.length];
                  if (prevPlan) setSelectedMobileTier(prevPlan.id);
                }
              }}
              className={`py-2 px-2 text-xs font-bold rounded-lg transition-colors text-center focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--accent) ${
                selectedMobileTier === p.id
                  ? 'bg-(--accent) text-(--on-accent) shadow-sm'
                  : 'text-(--muted) hover:text-(--text)'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop Plan Cards Overview (Grid) */}
      <div className="hidden lg:grid grid-cols-3 gap-8 mb-12">
        {plans.map((plan) => {
          const isPopular = plan.isPopular;
          const price = billingCycle === 'annual' ? plan.priceAnnual : plan.priceMonthly;
          const period = billingCycle === 'annual' ? plan.periodAnnual : plan.periodMonthly;

          return (
            <div
              key={plan.id}
              className={`relative rounded-3xl p-8 flex flex-col justify-between transition-all duration-300 ${
                isPopular
                  ? 'bg-(--surface) border-2 border-(--accent) shadow-(--shadow-lg) ring-4 ring-(--accent)/10'
                  : 'bg-(--surface) border border-(--border-hi) shadow-(--shadow-card) hover:shadow-(--shadow-card-hover)'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest bg-(--accent2) text-(--on-accent) shadow-md">
                  {plan.badge}
                </div>
              )}

              <div>
                <h3 className="text-2xl font-black text-(--text) font-[var(--font-head)] tracking-tight">
                  {plan.name}
                </h3>
                <p className="mt-2 text-sm text-(--muted) leading-relaxed min-h-[40px]">
                  {plan.tagline}
                </p>

                <div className="mt-6 pb-6 border-b border-(--border)">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl lg:text-5xl font-black text-(--text) font-[var(--font-head)] tracking-tight">
                      {price}
                    </span>
                    {price !== 'Custom' && (
                      <span className="text-sm font-semibold text-(--muted)">
                        / {billingCycle === 'annual' ? 'yr' : 'mo'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-(--muted) font-medium mt-1">{period}</p>
                </div>
              </div>

              <div className="mt-8 space-y-4">
                <button
                  type="button"
                  onClick={() => handleSelect(plan)}
                  className={`w-full py-3.5 px-6 rounded-full text-sm font-bold tracking-wide transition-all duration-200 shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent) ${
                    isPopular
                      ? 'bg-(--accent) text-(--on-accent) hover:opacity-95 hover:shadow-lg active:scale-[0.98]'
                      : 'bg-(--surface-hi) text-(--text) border border-(--border-hi) hover:bg-(--accent) hover:text-(--on-accent) active:scale-[0.98]'
                  }`}
                >
                  {plan.ctaText}
                </button>

                {plan.secondaryLinkText && (
                  <div className="text-center">
                    <ArrowAnchor
                      href={plan.secondaryLinkHref ?? '#'}
                      onClick={(e) => {
                        if (plan.onSecondaryLinkClick) {
                          e.preventDefault();
                          plan.onSecondaryLinkClick();
                        }
                      }}
                      className="text-xs transition-colors group"
                    >
                      {plan.secondaryLinkText}
                    </ArrowAnchor>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile Active Plan Card (Single Highlighted Tier) */}
      <div className="lg:hidden mb-10">
        {activeMobilePlan && (
          <div className="rounded-3xl p-6 bg-(--surface) border-2 border-(--accent) shadow-(--shadow-lg) relative">
            {activeMobilePlan.badge && (
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-(--accent2) text-(--on-accent) mb-3">
                {activeMobilePlan.badge}
              </span>
            )}
            <h3 className="text-2xl font-black text-(--text) font-[var(--font-head)]">
              {activeMobilePlan.name}
            </h3>
            <p className="mt-1.5 text-sm text-(--muted) leading-relaxed">
              {activeMobilePlan.tagline}
            </p>
            <div className="my-5 flex items-baseline gap-1.5 pb-4 border-b border-(--border)">
              <span className="text-3xl font-black text-(--text) font-[var(--font-head)]">
                {billingCycle === 'annual'
                  ? activeMobilePlan.priceAnnual
                  : activeMobilePlan.priceMonthly}
              </span>
              <span className="text-xs text-(--muted)">
                {billingCycle === 'annual'
                  ? activeMobilePlan.periodAnnual
                  : activeMobilePlan.periodMonthly}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleSelect(activeMobilePlan)}
              className="w-full py-3.5 px-6 rounded-full text-sm font-bold bg-(--accent) text-(--on-accent) shadow-md hover:opacity-95 active:scale-[0.98] transition-all"
            >
              {activeMobilePlan.ctaText}
            </button>
          </div>
        )}
      </div>

      {/* Detailed Comparison Matrix Table */}
      <div className="w-full overflow-hidden rounded-3xl border border-(--border-hi) bg-(--surface) shadow-(--shadow-card)">
        <div className="p-6 sm:p-8 bg-(--surface-hi)/50 border-b border-(--border-hi) flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-(--text) font-[var(--font-head)]">
              {t('comparison.matrixHeading', 'Comprehensive Feature Comparison')}
            </h3>
            <p className="text-xs sm:text-sm text-(--muted) mt-1">
              {t(
                'comparison.matrixSubheading',
                'Explore feature limits, contract capabilities, and service commitments across all tiers.'
              )}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" role="table">
            <caption className="sr-only">Workforce payroll tier comparison</caption>
            <thead>
              <tr className="border-b border-(--border-hi) bg-(--surface-hi)/30 text-xs font-bold uppercase tracking-wider text-(--muted)">
                <th scope="col" className="py-4 px-6 min-w-[240px]">
                  {t('comparison.features', 'Plan Features')}
                </th>
                {plans.map((p) => (
                  <th
                    key={p.id}
                    scope="col"
                    className={`py-4 px-6 text-center min-w-[160px] ${
                      p.isPopular ? 'text-(--accent) font-black bg-(--accent)/5' : ''
                    }`}
                  >
                    <span>{p.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-(--border)">
              {categories.map((category) => (
                <React.Fragment key={category.id}>
                  {/* Category Header Row */}
                  <tr className="bg-(--surface-hi)/80 text-(--text) font-bold text-xs uppercase tracking-wider">
                    <th
                      colSpan={plans.length + 1}
                      scope="colgroup"
                      className="py-3 px-6 text-(--accent) flex items-center gap-2"
                    >
                      {category.icon && (
                        <category.icon className="w-4 h-4 text-(--accent2)" aria-hidden="true" />
                      )}
                      <span>{category.title}</span>
                    </th>
                  </tr>

                  {/* Feature Rows */}
                  {category.features.map((feature) => (
                    <tr
                      key={feature.id}
                      className="hover:bg-(--surface-hi)/40 transition-colors duration-150"
                    >
                      <th
                        scope="row"
                        className="py-4 px-6 text-sm font-semibold text-(--text) align-middle"
                      >
                        <div className="flex flex-col">
                          <span className="text-(--text)">{feature.name}</span>
                          {feature.description && (
                            <span className="text-xs text-(--muted) font-normal mt-0.5">
                              {feature.description}
                            </span>
                          )}
                        </div>
                      </th>

                      {plans.map((plan) => {
                        const val = feature.values[plan.id];
                        const isPopular = plan.isPopular;

                        return (
                          <td
                            key={`${feature.id}-${plan.id}`}
                            className={`py-4 px-6 text-center text-sm align-middle ${
                              isPopular ? 'bg-(--accent)/5 font-medium' : ''
                            }`}
                          >
                            {typeof val === 'boolean' ? (
                              val ? (
                                <span
                                  role="img"
                                  aria-label={`Included in ${plan.name}`}
                                  className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-(--accent2)/15 text-(--accent2)"
                                >
                                  <Check
                                    className="w-4 h-4 stroke-[3]"
                                    aria-hidden="true"
                                  />
                                  <span className="sr-only">Included in {plan.name}</span>
                                </span>
                              ) : (
                                <span
                                  role="img"
                                  aria-label={`Not included in ${plan.name}`}
                                  className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-(--border)/30 text-(--muted)/60"
                                >
                                  <X
                                    className="w-4 h-4"
                                    aria-hidden="true"
                                  />
                                  <span className="sr-only">Not included in {plan.name}</span>
                                </span>
                              )
                            ) : (
                              <span className="text-xs sm:text-sm font-medium text-(--text)">
                                {val ?? '—'}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default PlanComparisonTable;
