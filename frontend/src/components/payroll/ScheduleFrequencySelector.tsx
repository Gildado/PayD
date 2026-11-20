import React from 'react';
import { useTranslation } from 'react-i18next';

export type Frequency = 'weekly' | 'bi-weekly' | 'monthly' | 'custom';

interface Props {
  value: Frequency;
  onChange: (freq: Frequency) => void;
}

export const ScheduleFrequencySelector: React.FC<Props> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const options: { label: string; value: Frequency; description: string }[] = [
    {
      label: t('schedule.frequencyWeekly'),
      value: 'weekly',
      description: t('schedule.frequencyWeeklyDescription'),
    },
    {
      label: t('schedule.frequencyBiWeekly'),
      value: 'bi-weekly',
      description: t('schedule.frequencyBiWeeklyDescription'),
    },
    {
      label: t('schedule.frequencyMonthly'),
      value: 'monthly',
      description: t('schedule.frequencyMonthlyDescription'),
    },
    {
      label: t('schedule.frequencyCustom'),
      value: 'custom',
      description: t('schedule.frequencyCustomDescription'),
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
      {options.map((opt) => {
        const isSelected = value === opt.value;
        return (
          <div
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`cursor-pointer rounded-xl p-4 transition-all duration-200 border flex flex-col justify-between ${
              isSelected
                ? 'border-(--accent) bg-(--accent)/10 ring-2 ring-(--accent)'
                : 'border-(--border) bg-(--surface) hover:border-(--accent)/40 hover:bg-(--surface-hi)'
            }`}
            role="radio"
            aria-checked={isSelected}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onChange(opt.value);
              }
            }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-sm text-(--text)">{opt.label}</span>
              <span
                className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                  isSelected
                    ? 'border-(--accent) bg-(--accent)'
                    : 'border-(--border-hi) bg-transparent'
                }`}
                aria-hidden="true"
              >
                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-(--on-accent)" />}
              </span>
            </div>
            <p className="text-xs text-(--muted) leading-relaxed">{opt.description}</p>
          </div>
        );
      })}
    </div>
  );
};
