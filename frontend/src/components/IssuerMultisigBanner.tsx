import { Alert } from '@stellar/design-system';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useConfiguredIssuerMultisig } from '../hooks/useConfiguredIssuerMultisig';

const AlertComponent = Alert as unknown as React.FC<Record<string, unknown>>;

/**
 * Surfaces when configured payout asset issuers require multiple on-chain signatures,
 * so operators can plan partial signing before submitting payments.
 */
export function IssuerMultisigBanner() {
  const { t } = useTranslation();
  const { multisigIssuers, isLoading, isError } = useConfiguredIssuerMultisig();

  if (isLoading || isError || multisigIssuers.length === 0) {
    return null;
  }

  const lines = multisigIssuers.map((row) => {
    const detail = row.summary ?? t('common.multisigConfigDetected');
    return `${row.code} issuer (${row.issuer.slice(0, 6)}…${row.issuer.slice(-4)}): ${detail}`;
  });

  const description = [
    t('common.issuerMultisigDescription'),
    ...lines.map((l) => `• ${l}`),
  ].join('\n');

  return (
    <div className="w-full mb-6" role="region" aria-label={t('common.issuerMultisigNotice')}>
      <AlertComponent variant="warning" title={t('common.issuerMultisigDetected')} placement="inline">
        <span className="whitespace-pre-line text-sm">{description}</span>
      </AlertComponent>
    </div>
  );
}