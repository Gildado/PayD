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
        <div className="bg-green-50 text-green-800 p-4 rounded-md border border-green-200">
          <h3 className="font-semibold text-lg">{t('schedule.scheduleActivated')}</h3>
          <p>{t('schedule.scheduleActivatedDescription')}</p>
        </div>
        <div className="max-w-2xl">
          <ScheduleSummaryCard {...formData} />
        </div>
        <button
          onClick={() => setIsSaved(false)}
          className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
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
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-6">{t('schedule.payrollScheduleConfiguration')}</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('schedule.payrollName')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder={t('schedule.payrollNamePlaceholder')}
            />
          </div>

          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('schedule.employeeGroup')}
            </label>
            <select
              name="group"
              value={formData.group}
              onChange={handleChange}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="all">{t('schedule.groupAllEmployees')}</option>
              <option value="full-time">{t('schedule.groupFullTimeOnly')}</option>
              <option value="part-time">{t('schedule.groupPartTimeOnly')}</option>
              <option value="contractors">{t('schedule.groupContractors')}</option>
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              {t('schedule.scheduleFrequency')} <span className="text-red-500">*</span>
            </label>
            <ScheduleFrequencySelector
              value={formData.frequency}
              onChange={handleFrequencyChange}
            />
          </div>

          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('schedule.startDate')} <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              name="startDate"
              value={formData.startDate}
              onChange={handleChange}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          <div className="col-span-2 md:col-span-1 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('schedule.executionTime')}</label>
              <input
                type="time"
                name="time"
                value={formData.time}
                onChange={handleChange}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('schedule.timezone')}</label>
              <select
                name="timezone"
                value={formData.timezone}
                onChange={handleChange}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">EST</option>
                <option value="America/Los_Angeles">PST</option>
                <option value="Europe/London">GMT</option>
              </select>
            </div>
          </div>

          <div className="col-span-2">
            <label className="flex items-center text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                name="notifyEmail"
                checked={formData.notifyEmail}
                onChange={handleChange}
                className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-500 mr-2"
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

      <div className="flex justify-end pt-2">
        <button
          type="button"
          className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 mr-4"
        >
          {t('common.cancel')}
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 flex items-center"
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