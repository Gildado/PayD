/**
 * Step 2 — SIMULATING: loading state while Soroban RPC preflights.
 * No focusable elements (the header Close button is hidden by the shell).
 */

import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';

export default function SimulatingStep() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-5">
      <div className="relative">
        <div className="w-16 h-16 rounded-full border-2 border-accent/20 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
        </div>
      </div>
      <div className="text-center">
        <p className="font-bold text-lg">{t('upgradeModal.simulatingUpgrade')}</p>
        <p className="text-sm text-muted mt-1">
          {t('upgradeModal.preflightingTransaction')}
        </p>
      </div>
    </div>
  );
}
