import { useState, useEffect } from 'react';

export const CountdownTimer = ({ targetDate }: { targetDate: Date | null }) => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [isLowTime, setIsLowTime] = useState(false);

  useEffect(() => {
    if (!targetDate) return;

    const updateTimeLeft = () => {
      const now = new Date().getTime();
      const distance = targetDate.getTime() - now;

      if (distance < 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return false;
      }

      const newTimeLeft = {
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000),
      };

      setTimeLeft(newTimeLeft);

      // Highlight when less than 1 hour remaining
      setIsLowTime(distance < 60 * 60 * 1000);

      return true;
    };

    if (!updateTimeLeft()) return;

    const interval = setInterval(() => {
      if (!updateTimeLeft()) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  if (!targetDate) return null;

  const segments = [
    { key: 'days', label: 'Days', value: String(timeLeft.days), show: timeLeft.days > 0 },
    { key: 'hours', label: 'Hrs', value: timeLeft.hours.toString().padStart(2, '0'), show: true },
    {
      key: 'minutes',
      label: 'Min',
      value: timeLeft.minutes.toString().padStart(2, '0'),
      show: true,
    },
    {
      key: 'seconds',
      label: 'Sec',
      value: timeLeft.seconds.toString().padStart(2, '0'),
      show: true,
    },
  ].filter((s) => s.show);

  return (
    <div
      className="grid grid-cols-2 gap-2 sm:gap-3 md:flex md:flex-wrap md:items-center md:gap-4"
      role="timer"
      aria-live="polite"
      aria-atomic="true"
      aria-label={`Time remaining: ${timeLeft.days} days, ${timeLeft.hours} hours, ${timeLeft.minutes} minutes, ${timeLeft.seconds} seconds until the next scheduled payroll run`}
    >
      {segments.map((segment) => (
        <div
          key={segment.key}
          className={`flex min-w-[4rem] sm:min-w-[4.5rem] flex-col items-center rounded-xl border transition-all duration-300 px-2 sm:px-3 py-2 ${
            isLowTime
              ? 'border-danger/30 bg-danger/5 shadow-lg shadow-danger/10'
              : 'border-(--border-hi) bg-(--surface)/50'
          }`}
        >
          <span
            className={`text-xl sm:text-2xl font-mono font-black transition-colors duration-300 ${
              isLowTime ? 'text-danger animate-pulse' : 'text-(--accent)'
            }`}
          >
            {segment.value}
          </span>
          <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-(--muted) mt-0.5">
            {segment.label}
          </span>
        </div>
      ))}
    </div>
  );
};
