import React from 'react';
import { useTranslation } from 'react-i18next';
import { Frequency } from './ScheduleFrequencySelector';

interface Props {
  name: string;
  frequency: Frequency;
  startDate: string;
  time: string;
  timezone: string;
  group: string;
}

export const ScheduleSummaryCard: React.FC<Props> = ({
  name,
  frequency,
  startDate,
  time,
  timezone,
  group,
}) => {
  const { t, i18n } = useTranslation();
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
      <div className="px-4 py-5 sm:px-6 bg-gray-50 border-b border-gray-200">
        <h3 className="text-sm leading-6 font-medium text-gray-900">{t('schedule.scheduleSummary')}</h3>
      </div>
      <div className="flex-1">
        <dl className="divide-y divide-gray-200">
          <div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">{t('schedule.name')}</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 font-medium">
              {name || '-'}
            </dd>
          </div>
          <div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">{t('schedule.frequency')}</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 capitalize">
              {frequency}
            </dd>
          </div>
          <div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">{t('schedule.firstRun')}</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
              {startDate ? new Date(startDate).toLocaleDateString(i18n.language) : '-'}{' '}
              {t('schedule.atTimeInTimezone', { time: time || '-', timezone })}
            </dd>
          </div>
          <div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">{t('schedule.group')}</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 capitalize">
              {group.replace('-', ' ') || '-'}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
};