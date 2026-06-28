import { render } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { EmployeeList } from '../EmployeeList';

vi.mock('../Avatar', () => ({
  Avatar: ({ name }: { name: string }) => <div data-testid="avatar">{name}</div>,
}));
vi.mock('../AvatarUpload', () => ({ AvatarUpload: () => null }));
vi.mock('../../hooks/useNotification', () => ({
  useNotification: () => ({
    notifySuccess: vi.fn(),
  }),
}));
vi.mock('../CSVUploader', () => ({ CSVUploader: () => null }));
vi.mock('../EmployeeRemovalConfirmModal', () => ({
  EmployeeRemovalConfirmModal: () => null,
}));

const employee = {
  id: 'emp-hover-1',
  name: 'Jane Doe',
  email: 'jane@example.com',
  position: 'Engineer',
  wallet: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDE',
  salary: 5000,
  status: 'Active' as const,
};

describe('EmployeeList row hover effects', () => {
  test('data rows include hover background class', () => {
    const { container } = render(<EmployeeList employees={[employee]} onAddEmployee={vi.fn()} />);

    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBeGreaterThan(0);

    rows.forEach((row) => {
      expect(row.className).toContain('hover:bg-white/5');
    });
  });

  test('data rows include transition class for smooth hover animation', () => {
    const { container } = render(<EmployeeList employees={[employee]} onAddEmployee={vi.fn()} />);

    const rows = container.querySelectorAll('tbody tr');
    rows.forEach((row) => {
      expect(row.className).toMatch(/transition/);
    });
  });
});
