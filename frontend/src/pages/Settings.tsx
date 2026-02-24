import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AvatarUpload } from '../components/AvatarUpload';
import { useNotification } from '../hooks/useNotification';
import { Save, X, Globe, Building2 } from 'lucide-react';

type OrgData = {
  name: string;
  contactEmail: string;
  preferredStablecoin: string;
  logoUrl?: string;
};

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { notifySuccess, notifyError } = useNotification();

  const [org, setOrg] = useState<OrgData>({
    name: '',
    contactEmail: '',
    preferredStablecoin: 'EURC',
    logoUrl: undefined,
  });
  const [initialOrg, setInitialOrg] = useState<OrgData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    void (async () => {
        const res = await fetch('/api/organization');
        if (!res.ok) return;
        const data = (await res.json()) as Partial<OrgData>;
        if (!mounted) return;
        const merged: OrgData = {
          name: data.name ?? '',
          contactEmail: data.contactEmail ?? '',
          preferredStablecoin: data.preferredStablecoin ?? 'EURC',
          logoUrl: data.logoUrl ?? undefined,
        };
        setOrg(merged);
        setInitialOrg(merged);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleChangeLanguage = (event: React.ChangeEvent<HTMLSelectElement>) => {
    void i18n.changeLanguage(event.target.value);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(org),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      
      notifySuccess(t('settings.saveSuccess'));
      setInitialOrg(org);
    } catch (err) {
      notifyError(t('settings.saveError', { error: err instanceof Error ? err.message : 'Unknown error' }));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (initialOrg) {
      setOrg(initialOrg);
      notifySuccess(t('settings.cancelButton'));
    }
  };

  const hasChanges = JSON.stringify(org) !== JSON.stringify(initialOrg);

  return (
    <div className="flex-1 flex flex-col items-center justify-start p-6 md:p-12 max-w-4xl mx-auto w-full page-fade">
      <div className="w-full mb-12 flex items-end justify-between border-b border-border-hi pb-8">
        <div>
          <h1 className="text-4xl font-black mb-2 tracking-tight text-glow">{t('settings.title')}</h1>
          <p className="text-muted">{t('settings.languageDescription')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 w-full">
        {/* Left Column: Language & Preferences */}
        <div className="lg:col-span-1 space-y-6">
          <div className="card glass noise p-6 min-h-[200px] flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-5 h-5 text-accent" />
              <h3 className="font-bold text-lg">{t('settings.languageLabel')}</h3>
            </div>
            <p className="text-sm text-muted mb-4">{t('settings.languageDescription')}</p>
            <select
              value={i18n.language}
              onChange={handleChangeLanguage}
              className="mt-auto w-full bg-black/20 border border-border-hi rounded-xl p-3 text-text outline-none focus:border-accent/50 focus:bg-accent/5 transition-all appearance-none cursor-pointer hover:bg-black/30"
            >
              <option value="en">{t('settings.languageEnglish')}</option>
              <option value="es">{t('settings.languageSpanish')}</option>
            </select>
          </div>
        </div>

        {/* Right Column: Organization Settings */}
        <div className="lg:col-span-3 space-y-6">
          <div className="card glass noise p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-accent/10 rounded-2xl text-accent">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{t('settings.orgSettingsTitle')}</h2>
                <p className="text-sm text-muted">{t('settings.orgSettingsSubtitle')}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="md:col-span-1 flex flex-col items-center justify-start pt-2">
                <AvatarUpload
                  email={org.contactEmail}
                  name={org.name}
                  currentImageUrl={org.logoUrl}
                  endpoint={'/api/organization/logo'}
                  onImageUpload={(url) => setOrg((s) => ({ ...s, logoUrl: url }))}
                />
              </div>

              <div className="md:col-span-3 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted px-1">
                    {t('settings.orgNameLabel')}
                  </label>
                  <input
                    className="w-full bg-black/20 border border-border-hi rounded-xl p-4 text-text placeholder:text-muted/30 focus:border-accent/50 focus:bg-accent/5 focus:outline-none transition-all"
                    value={org.name}
                    onChange={(e) => setOrg((s) => ({ ...s, name: e.target.value }))}
                    placeholder="Stellar Devs Inc."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted px-1">
                    {t('settings.orgEmailLabel')}
                  </label>
                  <input
                    className="w-full bg-black/20 border border-border-hi rounded-xl p-4 text-text placeholder:text-muted/30 focus:border-accent/50 focus:bg-accent/5 focus:outline-none transition-all"
                    value={org.contactEmail}
                    onChange={(e) => setOrg((s) => ({ ...s, contactEmail: e.target.value }))}
                    placeholder="contact@stellardevs.com"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted px-1">
                    {t('settings.orgStablecoinLabel')}
                  </label>
                  <div className="relative">
                    <select
                      className="w-full bg-black/20 border border-border-hi rounded-xl p-4 text-text appearance-none focus:border-accent/50 focus:bg-accent/5 focus:outline-none transition-all cursor-pointer"
                      value={org.preferredStablecoin}
                      onChange={(e) => setOrg((s) => ({ ...s, preferredStablecoin: e.target.value }))}
                    >
                      <option value="USDC">USDC (USD Coin)</option>
                      <option value="USDT">USDT (Tether)</option>
                      <option value="EURC">EURC (Euro Coin)</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-4">
                  <button
                    onClick={() => void handleSave()}
                    disabled={loading || !hasChanges}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-black text-sm font-bold rounded-xl hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {loading ? t('settings.saveButtonSaving') : t('settings.saveButton')}
                  </button>
                  
                  <button
                    onClick={handleCancel}
                    disabled={loading || !hasChanges}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 bg-surface-hi border border-border-hi text-text text-sm font-bold rounded-xl hover:bg-surface-hi/80 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <X className="w-4 h-4" />
                    <span>{t('settings.cancelButton')}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
