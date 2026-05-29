import React from 'react';
import { Frequency } from './ScheduleFrequencySelector';

interface Props {
  startDate: string;
  frequency: Frequency;
}

export const SchedulePreview: React.FC<Props> = ({ startDate, frequency }) => {
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
    return <div className="text-gray-500 italic text-sm">Select a start date to see preview</div>;
  }

  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 h-full">
      <h4 className="text-sm font-medium text-gray-900 mb-3">Upcoming Executions</h4>
      <ul className="space-y-2">
        {dates.map((date, index) => (
          <li key={index} className="flex items-center text-sm text-gray-600">
            <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs mr-3 font-semibold">
              {index + 1}
            </span>
            {date.toLocaleDateString(undefined, {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </li>
        ))}
      </ul>
    </div>
  );
};
