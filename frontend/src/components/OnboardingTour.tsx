import React from "react";
import Joyride, { Step, CallBackProps, STATUS } from "react-joyride";

const TOUR_STEPS: Step[] = [
  {
    target: "#tour-welcome",
    content: "Welcome to PayD! Let's take a quick tour to get you started.",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: "#tour-connect",
    content:
      "First, connect your Stellar wallet to securely manage your organization.",
    placement: "bottom",
  },
  {
    target: "#tour-employees",
    content:
      "Navigate here to set up your organization and manage your workforce.",
    placement: "bottom",
  },
  {
    target: "#tour-add-employee",
    content: "Add your employees here to include them in the payroll.",
    placement: "right",
  },
  {
    target: "#tour-payroll",
    content: "Once your team is set up, head over to the Payroll Scheduler.",
    placement: "bottom",
  },
  {
    target: "#tour-init-payroll",
    content:
      "Set up automated streams and fund your distribution account to pay your team in real-time.",
    placement: "top",
  },
];

export const OnboardingTour: React.FC<{
  run: boolean;
  onComplete: () => void;
}> = ({ run, onComplete }) => {
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
      styles={{
        options: {
          primaryColor: "#4AF0B8",
          textColor: "#fff",
          backgroundColor: "#111827",
          arrowColor: "#111827",
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: "12px",
          padding: "20px",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
        },
        tooltipContent: {
          padding: "10px 0",
          fontSize: "14px",
          lineHeight: "1.5",
        },
        buttonNext: {
          backgroundColor: "#4AF0B8",
          color: "#000",
          fontWeight: "800",
          borderRadius: "8px",
          padding: "10px 20px",
        },
        buttonBack: {
          color: "#9CA3AF",
          fontWeight: "600",
          marginRight: "10px",
        },
        buttonSkip: {
          color: "#9CA3AF",
          fontSize: "13px",
        },
        overlay: {
          backgroundColor: "rgba(0, 0, 0, 0.75)",
          backdropFilter: "blur(3px)",
        },
      }}
    />
  );
};
