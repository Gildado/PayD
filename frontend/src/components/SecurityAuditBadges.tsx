import { ArrowRight, BadgeCheck, FileCheck2, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  SECURITY_ATTESTATIONS,
  resolveAttestationHref,
  type SecurityAttestation,
  type SecurityAttestationKind,
} from '../config/securityAudits';

const KIND_ICON: Record<SecurityAttestationKind, typeof ShieldCheck> = {
  'third-party': BadgeCheck,
  'internal-review': ShieldCheck,
  policy: FileCheck2,
};

const KIND_TONE: Record<SecurityAttestationKind, string> = {
  'third-party': 'border-accent/30 bg-accent/10 text-accent',
  'internal-review': 'border-accent2/30 bg-accent2/10 text-accent2',
  policy: 'border-hi bg-white/5 text-muted',
};

function formatDate(iso: string, locale: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function AttestationBadge({ attestation }: { attestation: SecurityAttestation }) {
  const { t, i18n } = useTranslation();
  const Icon = KIND_ICON[attestation.kind];
  const kindLabel = t(`securityAudits.kind.${attestation.kind}`);

  return (
    <li className="flex">
      <a
        href={resolveAttestationHref(attestation.href)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t('securityAudits.viewReportAria', { title: attestation.title })}
        className="group flex w-full flex-col rounded-2xl border border-hi bg-surface p-5 transition-colors hover:border-accent/50 focus-visible:outline-2 focus-visible:outline-accent"
      >
        <div className="flex items-start justify-between gap-3">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${KIND_TONE[attestation.kind]}`}>
            <Icon size={20} aria-hidden="true" />
          </span>
          <span
            className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${KIND_TONE[attestation.kind]}`}
          >
            {kindLabel}
          </span>
        </div>

        <h3 className="mt-4 text-base font-bold text-text">{attestation.title}</h3>
        <p className="mt-1 text-xs text-muted">
          {attestation.issuer} ·{' '}
          <time dateTime={attestation.date}>{formatDate(attestation.date, i18n.language)}</time>
        </p>
        <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{attestation.scope}</p>

        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
          {t('securityAudits.viewReport')}
          <ArrowRight
            size={16}
            aria-hidden="true"
            className="transition-transform group-hover:translate-x-0.5"
          />
        </span>
      </a>
    </li>
  );
}

export default function SecurityAuditBadges({
  attestations = SECURITY_ATTESTATIONS,
}: {
  attestations?: SecurityAttestation[];
}) {
  const { t } = useTranslation();

  if (attestations.length === 0) return null;

  return (
    <section aria-labelledby="security-audits-title" className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-accent">
            {t('securityAudits.eyebrow')}
          </p>
          <h2 id="security-audits-title" className="text-2xl font-black tracking-tight text-text sm:text-3xl">
            {t('securityAudits.title')}
          </h2>
          <p className="text-sm leading-relaxed text-muted sm:text-base">{t('securityAudits.subtitle')}</p>
        </div>
        <a
          href={resolveAttestationHref('SECURITY.md')}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-bold text-bg shadow-lg shadow-accent/20 transition-transform hover:scale-[1.02] sm:w-auto"
        >
          <ShieldCheck size={16} aria-hidden="true" />
          {t('securityAudits.reportVulnerability')}
        </a>
      </div>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {attestations.map((attestation) => (
          <AttestationBadge key={attestation.id} attestation={attestation} />
        ))}
      </ul>
    </section>
  );
}
