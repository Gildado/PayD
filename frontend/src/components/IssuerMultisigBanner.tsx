import { Alert } from '@stellar/design-system';
import React from 'react';
import { useConfiguredIssuerMultisig } from '../hooks/useConfiguredIssuerMultisig';

const AlertComponent = Alert as unknown as React.FC<Record<string, unknown>>;

/**
 * Surfaces when configured payout asset issuers require multiple on-chain signatures,
 * so operators can plan partial signing before submitting payments.
 */
export function IssuerMultisigBanner() {
  const { multisigIssuers, isLoading, isError } = useConfiguredIssuerMultisig();

  if (isLoading || isError || multisigIssuers.length === 0) {
    return null;
  }

  const lines = multisigIssuers.map((row) => {
    const detail = row.summary ?? 'Multi-signature configuration detected.';
    return `${row.code} issuer (${row.issuer.slice(0, 6)}…${row.issuer.slice(-4)}): ${detail}`;
  });

  const description = [
    'One or more configured asset issuers use multisig. Payments involving these assets may need multiple wallet approvals; pass the transaction XDR between signers until thresholds are met before submission.',
    ...lines.map((l) => `• ${l}`),
  ].join('\n');

  return (
    <div className="w-full mb-6" role="region" aria-label="Issuer multisig notice">
      <AlertComponent variant="warning" title="Issuer multisig detected" placement="inline">
        <span className="whitespace-pre-line text-sm">{description}</span>
      </AlertComponent>
    </div>
  );
}
