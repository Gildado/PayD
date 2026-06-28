import React from 'react';
import { useTranslation } from 'react-i18next';
import Joyride, { Step, CallBackProps, STATUS, Locale } from 'react-joyride';

export const OnboardingTour: React.FC<{
  run: boolean;
  onComplete: () => void;
}> = ({ run, onComplete }) => {
  const { t } = useTranslation();

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

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      onComplete();
    }
  };

  return (
    <Joyride
      steps={TOUR_STEPS}
      run={run}
      continuous
      showProgress
      showSkipButton
      callback={handleJoyrideCallback}
      locale={locale}
      styles={{
        options: {
          primaryColor: '#4AF0B8',
          textColor: '#fff',
          backgroundColor: '#111827',
          arrowColor: '#111827',
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        },
        tooltipContent: {
          padding: '10px 0',
          fontSize: '14px',
          lineHeight: '1.5',
        },
        tooltipTitle: {
          fontSize: '16px',
          fontWeight: '800',
          marginBottom: '8px',
        },
        buttonNext: {
          backgroundColor: '#4AF0B8',
          color: '#000',
          fontWeight: '800',
          borderRadius: '8px',
          padding: '10px 20px',
        },
        buttonBack: {
          color: '#9CA3AF',
          fontWeight: '600',
          marginRight: '10px',
        },
        buttonSkip: {
          color: '#9CA3AF',
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
