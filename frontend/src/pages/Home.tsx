import { Icon } from '@stellar/design-system';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function Home() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <main className="flex min-h-[80vh] flex-col px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-10">
        <section
          className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]"
          aria-labelledby="home-hero-title"
        >
          <div className="space-y-8 text-center lg:text-left">
            <div className="mx-auto flex w-fit items-center gap-3 rounded-full border border-hi bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-muted lg:mx-0">
              <span id="tour-welcome" className="relative flex h-8 w-8 items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-accent/10 blur-md" />
                <Icon.Rocket01 size="sm" className="relative z-10 text-accent" />
              </span>
              Live payroll orchestration
            </div>

            <div className="space-y-5">
              <h1
                id="home-hero-title"
                className="text-4xl font-black leading-tight tracking-tighter sm:text-5xl lg:text-6xl"
              >
                {t('home.titleLine1Prefix')}{' '}
                <span className="text-accent">{t('home.titleLine1Highlight')}</span>
                <br />
                {t('home.titleLine2Prefix')}{' '}
                <span className="text-accent2">{t('home.titleLine2Highlight')}</span>
                {t('home.titleLine2Suffix')}
              </h1>

              <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted sm:text-xl lg:mx-0">
                {t('home.tagline')}
              </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center lg:justify-start">
              <button
                type="button"
                aria-label={t('home.ctaManagePayroll')}
                className="w-full rounded-xl bg-accent px-8 py-4 font-bold text-bg shadow-lg shadow-accent/20 transition-transform hover:scale-[1.02] sm:w-auto"
                onClick={() => {
                  void navigate('/payroll');
                }}
              >
                {t('home.ctaManagePayroll')}
              </button>
              <button
                type="button"
                aria-label={t('home.ctaViewEmployees')}
                className="w-full rounded-xl border border-hi px-8 py-4 font-bold text-text transition-all hover:border-accent/50 hover:bg-white/5 sm:w-auto"
                onClick={() => {
                  void navigate('/employee');
                }}
              >
                {t('home.ctaViewEmployees')}
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="glass noise rounded-2xl border border-hi px-4 py-3 text-left">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted">
                  Payroll control
                </p>
                <p className="mt-2 text-sm font-semibold text-text">Schedule, approve, ship.</p>
              </div>
              <div className="glass noise rounded-2xl border border-hi px-4 py-3 text-left">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted">
                  Employee ops
                </p>
                <p className="mt-2 text-sm font-semibold text-text">
                  Onboard without context loss.
                </p>
              </div>
              <div className="glass noise rounded-2xl border border-hi px-4 py-3 text-left">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted">
                  Secure delivery
                </p>
                <p className="mt-2 text-sm font-semibold text-text">Trace every payout event.</p>
              </div>
            </div>
          </div>

          <aside className="relative overflow-hidden rounded-[2rem] border border-hi bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] p-6 shadow-2xl shadow-black/20">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(74,240,184,0.16),transparent_42%),radial-gradient(circle_at_bottom_left,rgba(124,111,247,0.14),transparent_40%)]" />
            <div className="relative space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted">
                    Workspace snapshot
                  </p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-text">
                    Ready to ship payroll
                  </h2>
                </div>
                <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
                  Live
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-hi bg-black/10 p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-accent/10 p-2.5">
                      <Icon.CreditCard01 size="md" className="text-accent" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted">
                        Payments
                      </p>
                      <p className="mt-1 text-sm font-semibold text-text">
                        Single-transaction flow
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-hi bg-black/10 p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-accent2/10 p-2.5">
                      <Icon.Users01 size="md" className="text-accent2" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted">
                        Roster
                      </p>
                      <p className="mt-1 text-sm font-semibold text-text">
                        Keep employee data current
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-hi bg-black/10 p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-danger/10 p-2.5">
                      <Icon.ShieldTick size="md" className="text-danger" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted">
                        Controls
                      </p>
                      <p className="mt-1 text-sm font-semibold text-text">Audit-ready by default</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-hi bg-black/10 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[11px] font-black uppercase tracking-[0.24em] text-muted">
                      Flow
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted">
                        Routing
                      </p>
                      <p className="mt-1 text-sm font-semibold text-text">No switching friction</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </section>

        <section
          className="grid grid-cols-1 gap-6 text-left sm:grid-cols-2 lg:grid-cols-3"
          aria-label="Payroll platform highlights"
        >
          <div className="card glass noise rounded-[1.75rem]">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10">
              <Icon.CreditCard01 size="lg" className="text-accent" />
            </div>
            <h3 className="mb-3 text-xl font-bold">{t('home.card1Title')}</h3>
            <p className="text-sm leading-relaxed text-muted">{t('home.card1Body')}</p>
          </div>

          <div className="card glass noise rounded-[1.75rem]">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-accent2/20 bg-accent2/10">
              <Icon.Users01 size="lg" className="text-accent2" />
            </div>
            <h3 className="mb-3 text-xl font-bold">{t('home.card2Title')}</h3>
            <p className="text-sm leading-relaxed text-muted">{t('home.card2Body')}</p>
          </div>

          <div className="card glass noise rounded-[1.75rem]">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-danger/20 bg-danger/10">
              <Icon.ShieldTick size="lg" className="text-danger" />
            </div>
            <h3 className="mb-3 text-xl font-bold">{t('home.card3Title')}</h3>
            <p className="text-sm leading-relaxed text-muted">{t('home.card3Body')}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
