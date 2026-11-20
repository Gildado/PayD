import { use } from 'react';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../providers/AuthContext';
import { ONBOARDING_STEPS, useOrgOnboardingStore } from '../stores/orgOnboardingStore';
import { Button } from './common/Button';

/**
 * Dashboard entry point to first-run payroll setup. Shown to employers until
 * onboarding is completed; resumes on the step they left off.
 */
export function OnboardingBanner() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Read the context directly: outside an AuthProvider there is simply no banner.
  const auth = use(AuthContext);
  const { status, maxStepIndex } = useOrgOnboardingStore();

  if (auth?.user?.role !== 'EMPLOYER' || status === 'completed') return null;

  const started = status === 'in_progress';
  const percent = Math.round((maxStepIndex / ONBOARDING_STEPS.length) * 100);

  return (
    <section className="onb-banner" aria-labelledby="onb-banner-title">
      <div>
        <h2 id="onb-banner-title" className="onb-banner-title">
          {started ? t('orgOnboarding.banner.resumeTitle') : t('orgOnboarding.banner.title')}
        </h2>
        <p className="onb-banner-body">{t('orgOnboarding.banner.body')}</p>
        {started ? (
          <div className="onb-banner-meter">
            <div
              className="onb-progress-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-label={t('orgOnboarding.progressLabel')}
            >
              <div className="onb-progress-fill" style={{ width: `${percent}%` }} />
            </div>
            <span>
              {t('orgOnboarding.stepOf', {
                current: maxStepIndex + 1,
                total: ONBOARDING_STEPS.length,
              })}
            </span>
          </div>
        ) : null}
      </div>
      <Button className="shrink-0" onClick={() => void navigate('/onboarding')}>
        {started ? t('orgOnboarding.banner.resume') : t('orgOnboarding.banner.start')}
        <ArrowRight size={18} aria-hidden="true" />
      </Button>
    </section>
  );
}

export default OnboardingBanner;
