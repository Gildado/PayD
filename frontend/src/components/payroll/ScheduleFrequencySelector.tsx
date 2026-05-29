import React from 'react';

export type Frequency = 'weekly' | 'bi-weekly' | 'monthly' | 'custom';

interface Props {
  value: Frequency;
  onChange: (freq: Frequency) => void;
}

export const ScheduleFrequencySelector: React.FC<Props> = ({ value, onChange }) => {
  const options: { label: string; value: Frequency; description: string }[] = [
    { label: 'Weekly', value: 'weekly', description: 'Runs every week on the specified day' },
    { label: 'Bi-weekly', value: 'bi-weekly', description: 'Runs every two weeks' },
    { label: 'Monthly', value: 'monthly', description: 'Runs once per month' },
    { label: 'Custom', value: 'custom', description: 'Define a custom schedule' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {options.map((opt) => (
        <div
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`cursor-pointer border rounded-lg p-4 transition-all duration-200 ${
            value === opt.value
              ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-600'
              : 'border-gray-200 hover:border-indigo-300'
          }`}
          role="radio"
          aria-checked={value === opt.value}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              onChange(opt.value);
            }
          }}
        >
          <div className="font-medium text-gray-900">{opt.label}</div>
          <div className="text-sm text-gray-500 mt-1">{opt.description}</div>
        </div>
      ))}
    </div>
  );
};
