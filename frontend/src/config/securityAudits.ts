/**
 * Published smart-contract audit reports and security attestations surfaced
 * in the UI to build mainnet trust.
 *
 * Every entry must link to a report that actually exists. Internal reviews
 * are labelled as such; add third-party audits with `kind: 'third-party'`
 * only once the auditor's signed report is published.
 *
 * Links resolve against VITE_REPO_URL (defaults to the upstream repository).
 */

export type SecurityAttestationKind = 'third-party' | 'internal-review' | 'policy';

export interface SecurityAttestation {
  id: string;
  title: string;
  /** Who performed the review or maintains the policy. */
  issuer: string;
  kind: SecurityAttestationKind;
  /** ISO date (YYYY-MM-DD) the report was completed or last updated. */
  date: string;
  scope: string;
  /** Absolute URL, or a repository-relative path resolved via REPO_BLOB_BASE_URL. */
  href: string;
}

const REPO_URL = (
  (import.meta.env.VITE_REPO_URL as string | undefined) ?? 'https://github.com/Gildado/PayD'
).replace(/\/+$/, '');

export const REPO_BLOB_BASE_URL = `${REPO_URL}/blob/main`;

export function resolveAttestationHref(href: string): string {
  if (/^https?:\/\//i.test(href) || href.startsWith('/')) return href;
  return `${REPO_BLOB_BASE_URL}/${href}`;
}

export const SECURITY_ATTESTATIONS: SecurityAttestation[] = [
  {
    id: 'contracts-mainnet-audit',
    title: 'Smart-contract security audit',
    issuer: 'PayD contracts team',
    kind: 'internal-review',
    date: '2026-09-27',
    scope: 'All 8 Soroban contracts: rounding, privilege escalation, escrow invariants',
    href: 'contracts/README.md#mainnet-launch-readiness--security-audits',
  },
  {
    id: 'reentrancy-audit',
    title: 'Reentrancy & cross-contract call safety',
    issuer: 'PayD contracts team',
    kind: 'internal-review',
    date: '2026-09-26',
    scope: 'Every external token transfer checked for checks-effects-interactions',
    href: 'docs/REENTRANCY_AUDIT.md',
  },
  {
    id: 'circuit-breaker-audit',
    title: 'Circuit-breaker coverage audit',
    issuer: 'PayD security team',
    kind: 'internal-review',
    date: '2026-09-26',
    scope: 'Emergency pause enforced on every fund-moving function',
    href: 'CIRCUIT_BREAKER_AUDIT.md',
  },
  {
    id: 'storage-ttl-audit',
    title: 'Storage TTL & rent audit',
    issuer: 'PayD contracts team',
    kind: 'internal-review',
    date: '2026-09-26',
    scope: 'Persistent vs. temporary storage expiry safety',
    href: 'STORAGE_TTL_AUDIT.md',
  },
  {
    id: 'dependency-audit',
    title: 'Contract dependency audit',
    issuer: 'PayD contracts team',
    kind: 'internal-review',
    date: '2026-09-25',
    scope: 'OpenZeppelin stellar-contracts pinned versions',
    href: 'docs/DEPENDENCY_AUDIT.md',
  },
  {
    id: 'disclosure-policy',
    title: 'Responsible disclosure policy',
    issuer: 'RFC 9116 security.txt',
    kind: 'policy',
    date: '2026-09-26',
    scope: 'Private vulnerability reporting via GitHub security advisories',
    href: 'SECURITY.md',
  },
];
