import React, { useState } from 'react';
import { Frequency, ScheduleFrequencySelector } from './ScheduleFrequencySelector';
import { SchedulePreview } from './SchedulePreview';
import { ScheduleSummaryCard } from './ScheduleSummaryCard';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../hooks/useToast';

export const PayrollScheduleForm: React.FC = () => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    startDate: '',
    frequency: 'monthly' as Frequency,
    time: '09:00',
    timezone: 'UTC',
    group: 'all',
    notifyEmail: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleFrequencyChange = (frequency: Frequency) => {
    setFormData((prev) => ({ ...prev, frequency }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.startDate) {
      showError(t('schedule.validationErrorMessage'), t('schedule.validationErrorTitle'));
      return;
    }

    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setIsSaved(true);
      showSuccess(t('schedule.saveSuccessMessage'), t('schedule.saveSuccessTitle'));
    } catch {
      showError(t('schedule.saveErrorMessage'), t('schedule.saveErrorTitle'));
    } finally {
      setIsLoading(false);
    }
  };

  if (isSaved) {
    return (
      <div className="space-y-6">
        <div className="bg-(--success)/10 text-(--text) p-5 rounded-2xl border border-(--success)/30 flex flex-col gap-1">
          <h3 className="font-extrabold text-base text-(--success)">
            {t('schedule.scheduleActivated')}
          </h3>
          <p className="text-sm text-(--muted)">{t('schedule.scheduleActivatedDescription')}</p>
        </div>
        <div className="max-w-2xl">
          <ScheduleSummaryCard {...formData} />
        </div>
        <button
          onClick={() => setIsSaved(false)}
          className="mt-2 rounded-full bg-(--accent) text-(--on-accent) px-6 py-2.5 text-sm font-bold hover:brightness-110 shadow-sm transition"
        >
          {t('schedule.createAnother')}
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
      className="space-y-8 max-w-4xl"
    >
      <div className="bg-(--surface) shadow-sm border border-(--border-hi) rounded-2xl p-6 md:p-8">
        <h2 className="text-xl font-extrabold tracking-tight text-(--text) mb-6">
          {t('schedule.payrollScheduleConfiguration')}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="col-span-2 md:col-span-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-(--muted) mb-2">
              {t('schedule.payrollName')} <span className="text-(--danger)">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full rounded-xl border border-(--border-hi) bg-(--bg) px-3.5 py-2.5 text-sm text-(--text) shadow-sm transition placeholder:text-(--muted) focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/20"
              placeholder={t('schedule.payrollNamePlaceholder')}
            />
          </div>

          <div className="col-span-2 md:col-span-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-(--muted) mb-2">
              {t('schedule.employeeGroup')}
            </label>
            <select
              name="group"
              value={formData.group}
              onChange={handleChange}
              className="w-full rounded-xl border border-(--border-hi) bg-(--bg) px-3.5 py-2.5 text-sm text-(--text) shadow-sm transition focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/20"
            >
              <option value="all">{t('schedule.groupAllEmployees')}</option>
              <option value="full-time">{t('schedule.groupFullTimeOnly')}</option>
              <option value="part-time">{t('schedule.groupPartTimeOnly')}</option>
              <option value="contractors">{t('schedule.groupContractors')}</option>
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-(--muted) mb-3">
              {t('schedule.scheduleFrequency')} <span className="text-(--danger)">*</span>
            </label>
            <ScheduleFrequencySelector
              value={formData.frequency}
              onChange={handleFrequencyChange}
            />
          </div>

          <div className="col-span-2 md:col-span-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-(--muted) mb-2">
              {t('schedule.startDate')} <span className="text-(--danger)">*</span>
            </label>
            <input
              type="date"
              name="startDate"
              value={formData.startDate}
              onChange={handleChange}
              className="w-full rounded-xl border border-(--border-hi) bg-(--bg) px-3.5 py-2.5 text-sm text-(--text) shadow-sm transition focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/20"
            />
          </div>

          <div className="col-span-2 md:col-span-1 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-(--muted) mb-2">
                {t('schedule.executionTime')}
              </label>
              <input
                type="time"
                name="time"
                value={formData.time}
                onChange={handleChange}
                className="w-full rounded-xl border border-(--border-hi) bg-(--bg) px-3.5 py-2.5 text-sm text-(--text) shadow-sm transition focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/20"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-(--muted) mb-2">
                {t('schedule.timezone')}
              </label>
              <select
                name="timezone"
                value={formData.timezone}
                onChange={handleChange}
                className="w-full rounded-xl border border-(--border-hi) bg-(--bg) px-3.5 py-2.5 text-sm text-(--text) shadow-sm transition focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/20"
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">EST</option>
                <option value="America/Los_Angeles">PST</option>
                <option value="Europe/London">GMT</option>
              </select>
            </div>
          </div>

          <div className="col-span-2">
            <label className="flex items-center text-sm font-medium text-(--text) cursor-pointer select-none">
              <input
                type="checkbox"
                name="notifyEmail"
                checked={formData.notifyEmail}
                onChange={handleChange}
                className="rounded border-(--border-hi) text-(--accent) focus:ring-(--accent) mr-2.5"
              />
              {t('schedule.sendNotificationsOnExecution')}
            </label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="col-span-1">
          <SchedulePreview startDate={formData.startDate} frequency={formData.frequency} />
        </div>
        <div className="col-span-1">
          <ScheduleSummaryCard {...formData} />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          className="rounded-full border border-(--border-hi) bg-(--surface) text-(--text) px-5 py-2.5 text-sm font-semibold hover:bg-(--surface-hi) transition shadow-sm"
        >
          {t('common.cancel')}
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-full bg-(--accent) text-(--on-accent) px-7 py-2.5 text-sm font-bold hover:brightness-110 disabled:opacity-50 transition shadow-sm inline-flex items-center"
        >
          {isLoading ? (
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          ) : null}
          {isLoading ? t('schedule.saving') : t('schedule.saveSchedule')}
        </button>
      </div>
    </form>
  );
};
