import { useTranslation } from 'react-i18next';
import { Globe, Check, Moon, Sun } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useNotification } from '../hooks/useNotification';

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { notifySuccess } = useNotification();

  const languages = [
    { code: 'en', name: t('settings.languageEnglish'), nativeName: 'English' },
    { code: 'es', name: t('settings.languageSpanish'), nativeName: 'Español' },
  ];

  const handleChangeLanguage = (languageCode: string) => {
    void i18n.changeLanguage(languageCode);
    const langName = languages.find((l) => l.code === languageCode)?.nativeName ?? languageCode;
    notifySuccess(t('settings.languageSaved', { language: langName }));
  };

  const handleThemeChange = (mode: 'dark' | 'light') => {
    if (theme !== mode) toggleTheme();
  };

  const themeModes: { mode: 'dark' | 'light'; icon: React.ReactNode; label: string }[] = [
    {
      mode: 'dark',
      icon: <Moon className="h-4 w-4 text-[var(--muted)]" />,
      label: t('settings.themeDark'),
    },
    {
      mode: 'light',
      icon: <Sun className="h-4 w-4 text-[var(--muted)]" />,
      label: t('settings.themeLight'),
    },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-start p-6 md:p-12 max-w-4xl mx-auto w-full">
      <div className="w-full mb-8 md:mb-12 flex items-end justify-between border-b border-hi pb-6 md:pb-8">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
            User Preferences
          </p>
          <h1 className="text-3xl md:text-4xl font-black mb-2 tracking-tight mt-2">
            {t('settings.title')}
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Manage your application preferences and account settings
          </p>
        </div>
      </div>

      <div className="w-full space-y-6">
        {/* Language Settings */}
        <div className="card glass noise p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-hi)] p-2.5">
              <Globe className="h-5 w-5 text-[var(--accent)]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text)]">
                {t('settings.languageLabel')}
              </h2>
              <p className="text-sm text-[var(--muted)] mt-1">
                {t('settings.languageDescription')}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {languages.map((language) => (
              <button
                key={language.code}
                type="button"
                onClick={() => handleChangeLanguage(language.code)}
                className={`relative rounded-2xl border p-4 text-left transition ${
                  i18n.language === language.code
                    ? 'border-[var(--accent)] bg-[color:rgba(74,240,184,0.08)]'
                    : 'border-hi bg-[var(--surface-hi)]/70 hover:border-[var(--accent)]/50'
                }`}
                aria-label={`Select ${language.name}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-[var(--text)]">{language.nativeName}</p>
                    <p className="text-xs text-[var(--muted)] mt-1">{language.name}</p>
                  </div>
                  {i18n.language === language.code && (
                    <div className="rounded-full bg-[var(--accent)] p-1">
                      <Check className="h-4 w-4 text-[var(--bg)]" />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-[color:rgba(74,240,184,0.22)] bg-[color:rgba(74,240,184,0.08)] p-4">
            <p className="text-xs font-semibold text-[var(--text)]">
              Current Language: {languages.find((l) => l.code === i18n.language)?.nativeName}
            </p>
            <p className="text-xs text-[var(--muted)] mt-1">
              All interface text will be displayed in your selected language.
            </p>
          </div>
        </div>

        {/* Appearance / Theme Settings */}
        <div className="card glass noise p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-hi)] p-2.5">
              {theme === 'dark' ? (
                <Moon className="h-5 w-5 text-[var(--accent)]" />
              ) : (
                <Sun className="h-5 w-5 text-[var(--accent)]" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text)]">{t('settings.themeLabel')}</h2>
              <p className="text-sm text-[var(--muted)] mt-1">{t('settings.themeDescription')}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {themeModes.map(({ mode, icon, label }) => (
              <button
                key={mode}
                type="button"
                onClick={() => handleThemeChange(mode)}
                aria-pressed={theme === mode}
                className={`relative rounded-2xl border p-4 text-left transition ${
                  theme === mode
                    ? 'border-[var(--accent)] bg-[color:rgba(74,240,184,0.08)]'
                    : 'border-hi bg-[var(--surface-hi)]/70 hover:border-[var(--accent)]/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {icon}
                    <p className="text-sm font-bold text-[var(--text)]">{label}</p>
                  </div>
                  {theme === mode && (
                    <div className="rounded-full bg-[var(--accent)] p-1">
                      <Check className="h-4 w-4 text-[var(--bg)]" />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
