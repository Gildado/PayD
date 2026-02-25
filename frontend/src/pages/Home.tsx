import { Icon } from '@stellar/design-system';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function Home() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4 sm:px-6 py-12">
      {/* Icon glow */}
      <div
        id="tour-welcome"
        className="mb-8 sm:mb-10 p-6 sm:p-8 glass glow-mint rounded-full relative"
      >
        <Icon.Rocket01 size="xl" className="text-(--accent) relative z-20" />
        <div className="absolute inset-0 bg-(--accent) opacity-5 blur-2xl rounded-full" />
      </div>

      {/* Hero headline — scales down on mobile */}
      <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black mb-5 sm:mb-6 tracking-tighter leading-tight sm:leading-none">
        {t("home.titleLine1Prefix")}{" "}
        <span className="text-(--accent)">{t("home.titleLine1Highlight")}</span>
        <br className="hidden sm:block" /> {t("home.titleLine2Prefix")}{" "}
        <span className="text-(--accent2)">
          {t("home.titleLine2Highlight")}
        </span>
        {t("home.titleLine2Suffix")}
      </h1>

      {/* Sub-headline */}
      <p className="text-base sm:text-xl text-(--muted) max-w-2xl mb-10 sm:mb-12 leading-relaxed font-medium">
        {t("home.tagline")}
      </p>

      {/* CTA buttons — stack on mobile, side-by-side on sm+ */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 w-full sm:w-auto mt-4">
        <button
          className="touch-target w-full sm:w-auto px-8 py-4 bg-(--accent) text-bg font-bold rounded-xl hover:scale-105 transition-transform shadow-lg shadow-(--accent)/20 text-sm sm:text-base"
          onClick={() => {
            void navigate('/payroll');
          }}
        >
          {t('home.ctaManagePayroll')}
        </button>
        <button
          className="touch-target w-full sm:w-auto px-8 py-4 glass border-(--border-hi) text-(--text) font-bold rounded-xl hover:bg-white/5 transition-all outline-none text-sm sm:text-base"
          onClick={() => {
            void navigate('/employee');
          }}
        >
          {t('home.ctaViewEmployees')}
        </button>
      </div>

      {/* Feature cards — 1 col on mobile, 3 on md+ */}
      <div className="mt-16 sm:mt-24 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 text-left max-w-6xl w-full">
        <div className="card glass noise">
          <div className="w-11 h-11 rounded-lg bg-(--accent)/10 flex items-center justify-center mb-5 border border-(--accent)/20">
            <Icon.CreditCard01 size="lg" className="text-(--accent)" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold mb-2">{t("home.card1Title")}</h3>
          <p className="text-(--muted) text-sm leading-relaxed">
            {t("home.card1Body")}
          </p>
        </div>

        <div className="card glass noise">
          <div className="w-11 h-11 rounded-lg bg-(--accent2)/10 flex items-center justify-center mb-5 border border-(--accent2)/20">
            <Icon.Users01 size="lg" className="text-(--accent2)" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold mb-2">{t("home.card2Title")}</h3>
          <p className="text-(--muted) text-sm leading-relaxed">
            {t("home.card2Body")}
          </p>
        </div>

        <div className="card glass noise">
          <div className="w-11 h-11 rounded-lg bg-(--danger)/10 flex items-center justify-center mb-5 border border-(--danger)/20">
            <Icon.ShieldTick size="lg" className="text-(--danger)" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold mb-2">{t("home.card3Title")}</h3>
          <p className="text-(--muted) text-sm leading-relaxed">
            {t("home.card3Body")}
          </p>
        </div>
      </div>
    </div>
  );
}
