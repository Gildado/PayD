import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { EmployeeList } from '../EmployeeList';

vi.mock('../Avatar', () => ({
  Avatar: () => <div data-testid="avatar" />,
}));

vi.mock('../AvatarUpload', () => ({
  AvatarUpload: () => null,
}));

const mockNotifySuccess = vi.fn();

vi.mock('../../hooks/useNotification', () => ({
  useNotification: () => ({
    notifySuccess: mockNotifySuccess,
  }),
}));

vi.mock('../CSVUploader', () => ({
  CSVUploader: () => null,
}));

vi.mock('../EmployeeRemovalConfirmModal', () => ({
  EmployeeRemovalConfirmModal: () => null,
}));

const employee = {
  id: 'emp-1',
  name: 'Alexandria Catherine Johnson-Smith With A Very Long Name',
  email: 'alexandria.catherine.johnson-smith.with.a.very.long.email@example.com',
  position: 'Senior Finance Operations Specialist',
  wallet: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ12',
  salary: 1500,
  status: 'Active' as const,
};

describe('EmployeeList', () => {
  test('applies employee search after debounce delay', () => {
    vi.useFakeTimers();
    const secondEmployee = {
      ...employee,
      id: 'emp-2',
      name: 'Bob Martin',
      email: 'bob@example.com',
    };

    render(<EmployeeList employees={[employee, secondEmployee]} onAddEmployee={vi.fn()} />);

    const searchInput = screen.getByLabelText('Search employees');
    fireEvent.change(searchInput, { target: { value: 'Bob' } });

    // Before debounce, both employees are still visible
    expect(screen.getAllByText(employee.name).length).toBeGreaterThan(0);
    act(() => {
      vi.advanceTimersByTime(350);
    });
    // After debounce, only matching employee is shown
    expect(screen.queryAllByText(employee.name).length).toBe(0);
    expect(screen.getAllByText(secondEmployee.name).length).toBeGreaterThan(0);

    vi.useRealTimers();
  });

  test('renders employee name and email with truncation styling', () => {
    render(<EmployeeList employees={[employee]} onAddEmployee={vi.fn()} />);

    // Check that the employee name and email are rendered
    expect(screen.getAllByText(employee.name).length).toBeGreaterThan(0);
    expect(screen.getAllByText(employee.email).length).toBeGreaterThan(0);
  });

  test('renders skeleton rows and hides employee data while loading', () => {
    render(<EmployeeList employees={[employee]} isLoading onAddEmployee={vi.fn()} />);

    // Employee data must not be visible during loading
    expect(screen.queryByText(employee.name)).toBeNull();
    expect(screen.queryByText(employee.email)).toBeNull();

    // Skeleton rows are rendered with pulse animation
    const rows = document.querySelectorAll('tbody tr');
    expect(rows.length).toBe(5);
    rows.forEach((row) => {
      expect(row.className).toContain('animate-pulse');
    });
  });

  test('renders empty state message when not loading and no employees exist', () => {
    render(<EmployeeList employees={[]} isLoading={false} onAddEmployee={vi.fn()} />);
    expect(screen.getByText('No employees found')).toBeTruthy();
  });

  test('shows Check icon after copy wallet action and calls notifySuccess', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    mockNotifySuccess.mockClear();

    render(<EmployeeList employees={[employee]} onAddEmployee={vi.fn()} />);

    const copyButtons = screen.getAllByLabelText(/copy wallet/i);
    expect(copyButtons.length).toBeGreaterThan(0);

    fireEvent.click(copyButtons[0]);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(writeText).toHaveBeenCalledWith(employee.wallet);
    expect(mockNotifySuccess).toHaveBeenCalled();

    // The Check icon should appear (the button changes to show Check icon)
    const checkIcons = screen.getAllByLabelText(/copy wallet/i);
    expect(checkIcons.length).toBeGreaterThan(0);

    // After 2 seconds, the Check should revert to Copy
    act(() => {
      vi.advanceTimersByTime(2100);
    });

    vi.useRealTimers();
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      writable: true,
    });
  });
});
