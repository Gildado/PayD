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
    <div className="bg-(--surface) rounded-2xl shadow-sm border border-(--border-hi) overflow-hidden h-full flex flex-col">
      <div className="px-5 py-4 bg-(--surface-hi) border-b border-(--border-hi)">
        <h3 className="text-xs uppercase tracking-wider font-bold text-(--text)">
          {t('schedule.scheduleSummary')}
        </h3>
      </div>
      <div className="flex-1">
        <dl className="divide-y divide-(--border)">
          <div className="px-5 py-3.5 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-(--muted)">
              {t('schedule.name')}
            </dt>
            <dd className="mt-1 text-sm text-(--text) sm:mt-0 sm:col-span-2 font-bold">
              {name || '—'}
            </dd>
          </div>
          <div className="px-5 py-3.5 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-(--muted)">
              {t('schedule.frequency')}
            </dt>
            <dd className="mt-1 text-sm text-(--text) sm:mt-0 sm:col-span-2 capitalize font-semibold">
              {frequency}
            </dd>
          </div>
          <div className="px-5 py-3.5 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-(--muted)">
              {t('schedule.firstRun')}
            </dt>
            <dd className="mt-1 text-sm text-(--text) sm:mt-0 sm:col-span-2 font-medium">
              {startDate ? new Date(startDate).toLocaleDateString(i18n.language) : '—'}{' '}
              <span className="text-xs text-(--muted)">
                {t('schedule.atTimeInTimezone', { time: time || '—', timezone })}
              </span>
            </dd>
          </div>
          <div className="px-5 py-3.5 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-(--muted)">
              {t('schedule.group')}
            </dt>
            <dd className="mt-1 text-sm text-(--text) sm:mt-0 sm:col-span-2 capitalize font-medium">
              {group.replace('-', ' ') || '—'}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
};
