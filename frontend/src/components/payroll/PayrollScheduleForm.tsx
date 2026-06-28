import React, { useState } from 'react';
import { Frequency, ScheduleFrequencySelector } from './ScheduleFrequencySelector';
import { SchedulePreview } from './SchedulePreview';
import { ScheduleSummaryCard } from './ScheduleSummaryCard';
import { useToast } from '../../hooks/useToast';

export const PayrollScheduleForm: React.FC = () => {
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
      showError('Please fill in all required fields.', 'Validation Error');
      return;
    }

    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setIsSaved(true);
      showSuccess('Payroll schedule configured successfully!', 'Success');
    } catch {
      showError('Failed to save schedule.', 'Server Error');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSaved) {
    return (
      <div className="space-y-6">
        <div className="bg-green-50 text-green-800 p-4 rounded-md border border-green-200">
          <h3 className="font-semibold text-lg">Schedule Activated</h3>
          <p>Your payroll schedule has been successfully created and is now active.</p>
        </div>
        <div className="max-w-2xl">
          <ScheduleSummaryCard {...formData} />
        </div>
        <button
          onClick={() => setIsSaved(false)}
          className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
        >
          Create Another
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
        <h2 className="text-xl font-semibold mb-6">Payroll Schedule Configuration</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payroll Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="e.g. Full Time Employees Monthly"
            />
          </div>

          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Employee Group</label>
            <select
              name="group"
              value={formData.group}
              onChange={handleChange}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="all">All Employees</option>
              <option value="full-time">Full-Time Only</option>
              <option value="part-time">Part-Time Only</option>
              <option value="contractors">Contractors</option>
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Schedule Frequency <span className="text-red-500">*</span>
            </label>
            <ScheduleFrequencySelector
              value={formData.frequency}
              onChange={handleFrequencyChange}
            />
          </div>

          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date <span className="text-red-500">*</span>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Execution Time</label>
              <input
                type="time"
                name="time"
                value={formData.time}
                onChange={handleChange}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
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
              Send notifications to employee group on execution
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
          Cancel
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
          {isLoading ? 'Saving...' : 'Save Schedule'}
        </button>
      </div>
    </form>
  );
};
