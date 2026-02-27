import { useTranslation } from 'react-i18next';
import NetworkSwitcher from '../components/NetworkSwitcher';
import { useNetwork } from '../hooks/useNetwork';

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { config, isTestnet } = useNetwork();

  const handleChangeLanguage = (event: React.ChangeEvent<HTMLSelectElement>) => {
    void i18n.changeLanguage(event.target.value);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-start p-12 max-w-3xl mx-auto w-full">
      <div className="w-full mb-12 flex items-end justify-between border-b border-hi pb-8">
        <div>
          <h1 className="text-4xl font-black mb-2 tracking-tight">{t('settings.title')}</h1>
        </div>
      </div>

      <div className="w-full flex flex-col gap-6">
        {/* Language */}
        <div className="card glass noise p-8">
          <div className="flex flex-col gap-3">
            <label className="block text-xs font-bold uppercase tracking-widest text-muted">
              {t('settings.languageLabel')}
            </label>
            <p className="text-sm text-muted">{t('settings.languageDescription')}</p>
            <select
              value={i18n.language}
              onChange={handleChangeLanguage}
              className="w-full bg-black/20 border border-hi rounded-xl p-4 text-text outline-none focus:border-accent/50 focus:bg-accent/5 transition-all"
            >
              <option value="en">{t('settings.languageEnglish')}</option>
              <option value="es">{t('settings.languageSpanish')}</option>
            </select>
          </div>
        </div>

        {/* Network */}
        <div className="card glass noise p-8">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-widest text-muted">
                Network
              </label>
              <span
                className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-widest border ${
                  isTestnet
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    : 'bg-accent/20 text-accent border-accent/30'
                }`}
              >
                {config.displayName}
              </span>
            </div>
            <p className="text-sm text-muted">
              Connect to Stellar Testnet for development, or Mainnet for production. Switching
              networks will disconnect your wallet and clear all cached data.
            </p>
            <div className="flex flex-wrap items-start gap-6">
              <NetworkSwitcher />
              <div className="flex flex-col gap-1 text-xs text-muted font-mono">
                <span>Horizon: {config.horizonUrl}</span>
                <span>RPC: {config.rpcUrl}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
