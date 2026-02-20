import { Icon } from "@stellar/design-system";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function Home() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-6 py-12">
      <div id="tour-welcome" className="mb-10 p-8 glass glow-mint rounded-full relative">
        <Icon.Rocket01 size="xl" className="text-accent relative z-20" />
        <div className="absolute inset-0 bg-accent opacity-5 blur-2xl rounded-full" />
      </div>

      <h1 className="text-6xl font-black mb-6 tracking-tighter leading-none">
        {t("home.titleLine1Prefix")}{" "}
        <span className="text-accent">{t("home.titleLine1Highlight")}</span>
        <br />
        {t("home.titleLine2Prefix")}{" "}
        <span className="text-accent2">{t("home.titleLine2Highlight")}</span>
        {t("home.titleLine2Suffix")}
      </h1>

      <p className="text-xl text-muted max-w-2xl mb-12 leading-relaxed font-medium">
        {t("home.tagline")}
      </p>

      <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6">
        <button
          className="px-8 py-4 bg-accent text-bg font-bold rounded-xl hover:scale-105 transition-transform shadow-lg shadow-accent/20"
          onClick={() => {
            void navigate("/payroll");
          }}
        >
          {t("home.ctaManagePayroll")}
        </button>
        <button
          className="px-8 py-4 glass border-hi text-text font-bold rounded-xl hover:bg-white/5 transition-all outline-none"
          onClick={() => {
            void navigate("/employee");
          }}
        >
          {t("home.ctaViewEmployees")}
        </button>
      </div>

      <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 text-left max-w-6xl w-full">
        <div className="card glass noise">
          <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-6 border border-accent/20">
            <Icon.CreditCard01 size="lg" className="text-accent" />
          </div>
          <h3 className="text-xl font-bold mb-3">{t("home.card1Title")}</h3>
          <p className="text-muted text-sm leading-relaxed">{t("home.card1Body")}</p>
        </div>

        <div className="card glass noise">
          <div className="w-12 h-12 rounded-lg bg-accent2/10 flex items-center justify-center mb-6 border border-accent2/20">
            <Icon.Users01 size="lg" className="text-accent2" />
          </div>
          <h3 className="text-xl font-bold mb-3">{t("home.card2Title")}</h3>
          <p className="text-muted text-sm leading-relaxed">{t("home.card2Body")}</p>
        </div>

        <div className="card glass noise">
          <div className="w-12 h-12 rounded-lg bg-danger/10 flex items-center justify-center mb-6 border border-danger/20">
            <Icon.ShieldTick size="lg" className="text-danger" />
          </div>
          <h3 className="text-xl font-bold mb-3">{t("home.card3Title")}</h3>
          <p className="text-muted text-sm leading-relaxed">{t("home.card3Body")}</p>
        </div>
      </div>
    </div>
  );
}
