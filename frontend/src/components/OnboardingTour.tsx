import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Joyride, { Step, CallBackProps, STATUS, Locale } from 'react-joyride';
import { useOnboardingTourStore } from '../stores/onboardingTourStore';

export const OnboardingTour: React.FC<{
  run: boolean;
  onComplete: () => void;
}> = ({ run, onComplete }) => {
  const { t } = useTranslation();
  const { status, completeTour, dismissTour, setStepIndex } = useOnboardingTourStore();

  const TOUR_STEPS: Step[] = [
    {
      target: '#tour-welcome',
      content: t('onboarding.welcomeMessage'),
      placement: 'bottom',
      disableBeacon: true,
      title: t('onboarding.welcome'),
    },
    {
      target: '#tour-connect',
      content: t('onboarding.step1Message'),
      placement: 'bottom',
      title: t('onboarding.step1Title'),
    },
    {
      target: '#tour-employees',
      content: t('onboarding.step2Message'),
      placement: 'bottom',
      title: t('onboarding.step2Title'),
    },
    {
      target: '#tour-add-employee',
      content: t('onboarding.step3Message'),
      placement: 'right',
      title: t('onboarding.step3Title'),
    },
    {
      target: '#tour-payroll',
      content: t('onboarding.step4Message'),
      placement: 'bottom',
      title: t('onboarding.step4Title'),
    },
    {
      target: '#tour-init-payroll',
      content: t('onboarding.step5Message'),
      placement: 'top',
      title: t('onboarding.step5Title'),
    },
  ];

  const locale: Locale = {
    back: t('onboarding.back'),
    close: 'Close',
    last: t('onboarding.finish'),
    next: t('onboarding.next'),
    open: 'Open',
    skip: t('onboarding.skip'),
  };

  const shouldRun = run && (status === 'not_started' || status === 'in_progress');

  useEffect(() => {
    if (status === 'not_started' && run) {
      useOnboardingTourStore.setState({ status: 'in_progress' });
    }
  }, [status, run]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status: callbackStatus, stepIndex, type } = data;

    if (type === 'step:after' && typeof stepIndex === 'number') {
      setStepIndex(stepIndex);
    }

    if (callbackStatus === STATUS.FINISHED) {
      completeTour();
      onComplete();
    } else if (callbackStatus === STATUS.SKIPPED) {
      dismissTour();
      onComplete();
    } else if (callbackStatus === STATUS.ERROR) {
      dismissTour();
      onComplete();
    }
  };

  return (
    <Joyride
      steps={TOUR_STEPS}
      run={shouldRun}
      continuous
      showProgress
      showSkipButton
      callback={handleJoyrideCallback}
      locale={locale}
      styles={{
        options: {
          primaryColor: 'var(--accent)',
          textColor: 'var(--text)',
          backgroundColor: 'var(--surface)',
          arrowColor: 'var(--surface)',
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: '16px',
          padding: '20px',
          border: '1px solid var(--border-hi)',
          boxShadow: 'var(--shadow-lg)',
          backgroundColor: 'var(--surface)',
          color: 'var(--text)',
        },
        tooltipContent: {
          padding: '10px 0',
          fontSize: '14px',
          lineHeight: '1.5',
          color: 'var(--text)',
        },
        tooltipTitle: {
          fontSize: '16px',
          fontWeight: '800',
          marginBottom: '8px',
          color: 'var(--text)',
        },
        buttonNext: {
          backgroundColor: 'var(--accent)',
          color: 'var(--on-accent)',
          fontWeight: '700',
          borderRadius: '999px',
          padding: '10px 20px',
        },
        buttonBack: {
          color: 'var(--muted)',
          fontWeight: '600',
          marginRight: '10px',
        },
        buttonSkip: {
          color: 'var(--muted)',
          fontSize: '13px',
        },
        overlay: {
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(3px)',
        },
      }}
    />
  );
};
