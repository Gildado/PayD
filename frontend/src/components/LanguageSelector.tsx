import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

export const LanguageSelector = () => {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'en' ? 'es' : 'en';
    void i18n.changeLanguage(nextLang);
  };

  const currentLang = i18n.language === 'en' ? 'English' : 'Español';
  const nextLang = i18n.language === 'en' ? 'Español' : 'English';

  return (
    <button
      onClick={toggleLanguage}
      className="px-3 py-2 rounded-lg border transition-all outline-none focus:outline-none focus:ring-2 focus:ring-offset-0 flex items-center gap-2 text-xs font-bold uppercase tracking-widest min-h-[44px] hover:bg-surface-hi active:scale-95"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)',
        color: 'var(--text)',
      }}
      title={i18n.language === 'en' ? 'Cambiar a Español' : 'Switch to English'}
      aria-label={`Change language to ${nextLang}. Current language: ${currentLang}`}
      aria-pressed={false}
    >
      <Globe size={16} aria-hidden="true" style={{ color: 'var(--accent)' }} />
      <span aria-hidden="true">{i18n.language === 'en' ? 'EN' : 'ES'}</span>
      <span className="sr-only">{currentLang}</span>
    </button>
  );
};
