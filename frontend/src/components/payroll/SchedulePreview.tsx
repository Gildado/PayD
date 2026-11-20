import React from 'react';
import { useTranslation } from 'react-i18next';
import { Frequency } from './ScheduleFrequencySelector';

interface Props {
  startDate: string;
  frequency: Frequency;
}

export const SchedulePreview: React.FC<Props> = ({ startDate, frequency }) => {
  const { t, i18n } = useTranslation();
  const getUpcomingDates = () => {
    if (!startDate) return [];
    const dates = [];
    const current = new Date(startDate);

    for (let i = 0; i < 5; i++) {
      dates.push(new Date(current));
      if (frequency === 'weekly') {
        current.setDate(current.getDate() + 7);
      } else if (frequency === 'bi-weekly') {
        current.setDate(current.getDate() + 14);
      } else if (frequency === 'monthly') {
        current.setMonth(current.getMonth() + 1);
      } else {
        current.setDate(current.getDate() + 1);
      }
    }
    return dates;
  };

  const dates = getUpcomingDates();

  if (dates.length === 0) {
    return (
      <div className="bg-(--surface-hi) rounded-2xl p-5 border border-(--border-hi) h-full flex items-center justify-center text-(--muted) italic text-xs">
        {t('schedule.selectStartDatePreview')}
      </div>
    );
  }

  return (
    <div className="bg-(--surface-hi) rounded-2xl p-5 border border-(--border-hi) h-full flex flex-col justify-between">
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-(--muted) mb-3.5">
          {t('schedule.upcomingExecutions')}
        </h4>
        <ul className="space-y-2.5">
          {dates.map((date, index) => (
            <li
              key={date.toISOString()}
              className="flex items-center text-sm font-medium text-(--text) bg-(--surface) p-2.5 rounded-xl border border-(--border)"
            >
              <span className="w-6 h-6 rounded-full bg-(--accent)/15 text-(--accent) flex items-center justify-center text-xs mr-3 font-bold flex-shrink-0">
                {index + 1}
              </span>
              <span>
                {date.toLocaleDateString(i18n.language, {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
