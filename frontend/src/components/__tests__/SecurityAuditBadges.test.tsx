import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SecurityAuditBadges from '../SecurityAuditBadges';
import {
  REPO_BLOB_BASE_URL,
  SECURITY_ATTESTATIONS,
  resolveAttestationHref,
  type SecurityAttestation,
} from '../../config/securityAudits';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { title?: string }) => (opts?.title ? `${key}:${opts.title}` : key),
    i18n: { language: 'en' },
  }),
}));

const thirdParty: SecurityAttestation = {
  id: 'ext',
  title: 'External audit',
  issuer: 'Example Auditor',
  kind: 'third-party',
  date: '2026-09-01',
  scope: 'All contracts',
  href: 'https://example.com/report.pdf',
};

describe('SecurityAuditBadges', () => {
  it('renders a labelled section with one badge per attestation', () => {
    render(<SecurityAuditBadges />);

    const section = screen.getByRole('region', { name: 'securityAudits.title' });
    const items = within(section).getAllByRole('listitem');
    expect(items).toHaveLength(SECURITY_ATTESTATIONS.length);
  });

  it('links each badge to its report in a new tab', () => {
    render(<SecurityAuditBadges />);

    for (const attestation of SECURITY_ATTESTATIONS) {
      const link = screen.getByRole('link', {
        name: `securityAudits.viewReportAria:${attestation.title}`,
      });
      expect(link).toHaveAttribute('href', resolveAttestationHref(attestation.href));
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  it('labels the attestation kind and completion date', () => {
    render(<SecurityAuditBadges attestations={[thirdParty]} />);

    expect(screen.getByText('securityAudits.kind.third-party')).toBeInTheDocument();
    expect(screen.getByText('Sep 1, 2026')).toHaveAttribute('dateTime', '2026-09-01');
    expect(
      screen.getByRole('link', { name: 'securityAudits.viewReportAria:External audit' })
    ).toHaveAttribute('href', 'https://example.com/report.pdf');
  });

  it('renders nothing when there are no attestations', () => {
    const { container } = render(<SecurityAuditBadges attestations={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('resolveAttestationHref', () => {
  it('resolves repository-relative paths against the repo blob URL', () => {
    expect(resolveAttestationHref('SECURITY.md')).toBe(`${REPO_BLOB_BASE_URL}/SECURITY.md`);
  });

  it('leaves absolute and root-relative URLs untouched', () => {
    expect(resolveAttestationHref('https://example.com/a.pdf')).toBe('https://example.com/a.pdf');
    expect(resolveAttestationHref('/.well-known/security.txt')).toBe('/.well-known/security.txt');
  });
});
