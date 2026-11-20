import { act, render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { EmployeeSkeletonCard, EmployeeSkeletonRow } from '../EmployeeSkeleton';
import { EmptyState } from '../EmptyState';
import type { Employee } from '../types';
import { copyWithFallback, shortenWallet } from '../utils';
import { useEmployeeList } from '../useEmployeeList';

const notifySuccess = vi.fn();

vi.mock('../../../hooks/useNotification', () => ({
  useNotification: () => ({ notifySuccess }),
}));

const makeEmployee = (overrides: Partial<Employee> = {}): Employee => ({
  id: 'e1',
  name: 'Alice',
  email: 'alice@example.com',
  position: 'Engineer',
  wallet: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF',
  salary: 1000,
  status: 'Active',
  ...overrides,
});

describe('extracted presentational pieces', () => {
  test('shortenWallet formats and handles a missing wallet', () => {
    expect(shortenWallet('GABCDEFGHIJKLMNOPQRSTUVWXYZ')).toBe('GABC...WXYZ');
    expect(shortenWallet('')).toBe('No wallet assigned');
  });

  test('copyWithFallback prefers the async clipboard API', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    await copyWithFallback('payload');
    expect(writeText).toHaveBeenCalledWith('payload');
  });

  test('EmptyState switches copy when a search term is present', () => {
    const { rerender } = render(<EmptyState searchQuery="" />);
    expect(screen.getByText('No employees found')).toBeTruthy();

    rerender(<EmptyState searchQuery="Bob" />);
    expect(screen.getByText('No employees match "Bob"')).toBeTruthy();
  });

  test('skeleton pieces keep the pulse animation class', () => {
    const { container } = render(
      <table>
        <tbody>
          <EmployeeSkeletonRow />
        </tbody>
      </table>
    );
    expect(container.querySelector('tbody tr')?.className).toContain('animate-pulse');

    const cards = render(<EmployeeSkeletonCard />);
    expect(cards.container.firstElementChild?.className).toContain('animate-pulse');
  });
});

describe('useEmployeeList hook', () => {
  beforeEach(() => {
    notifySuccess.mockClear();
  });

  const setup = (employees: Employee[], overrides: Partial<Parameters<typeof useEmployeeList>[0]> = {}) =>
    renderHook(() =>
      useEmployeeList({
        employees,
        onAddEmployee: vi.fn(),
        ...overrides,
      })
    );

  test('sorts by salary in both directions', () => {
    const employees = [
      makeEmployee({ id: 'a', name: 'A', salary: 2000 }),
      makeEmployee({ id: 'b', name: 'B', salary: 1000 }),
    ];
    const { result } = setup(employees);

    act(() => result.current.handleSort('salary'));
    expect(result.current.displayedEmployees.map((e) => e.id)).toEqual(['b', 'a']);

    act(() => result.current.handleSort('salary'));
    expect(result.current.displayedEmployees.map((e) => e.id)).toEqual(['a', 'b']);
  });

  test('filters by status and clears filters', () => {
    const employees = [
      makeEmployee({ id: 'a', status: 'Active' }),
      makeEmployee({ id: 'b', status: 'Inactive' }),
    ];
    const { result } = setup(employees);

    act(() => result.current.setStatusFilter('Inactive'));
    expect(result.current.displayedEmployees.map((e) => e.id)).toEqual(['b']);

    act(() => result.current.clearFilters());
    expect(result.current.statusFilter).toBe('All');
    expect(result.current.displayedEmployees).toHaveLength(2);
  });

  test('reorder mode snapshots the sorted list and drag-end reorders it', () => {
    const employees = [makeEmployee({ id: 'a' }), makeEmployee({ id: 'b' })];
    const { result } = setup(employees);

    act(() => result.current.toggleReorderMode());
    expect(result.current.reorderMode).toBe(true);
    expect(result.current.displayedEmployees.map((e) => e.id)).toEqual(['a', 'b']);

    act(() =>
      result.current.handleDragEnd({
        source: { droppableId: 'employee-table', index: 0 },
        destination: { droppableId: 'employee-table', index: 1 },
        draggableId: 'a',
        type: 'DEFAULT',
        reason: 'DROP',
        mode: 'FLUID',
      })
    );
    expect(result.current.displayedEmployees.map((e) => e.id)).toEqual(['b', 'a']);
  });

  test('edit submit sends the updated salary and closes the modal', () => {
    const onEditEmployee = vi.fn();
    const employee = makeEmployee({ salary: 1000 });
    const { result } = setup([employee], { onEditEmployee });

    act(() => result.current.openEditModal(employee));
    expect(result.current.showEditModal.open).toBe(true);

    act(() => result.current.updateEditSalary(2500));
    act(() => result.current.handleEditModalSubmit());

    expect(onEditEmployee).toHaveBeenCalledWith({ ...employee, salary: 2500 });
    expect(result.current.showEditModal.open).toBe(false);
  });

  test('image upload prefers onUpdateEmployeeImage and closes the modal', () => {
    const onUpdateEmployeeImage = vi.fn();
    const employee = makeEmployee();
    const { result } = setup([employee], { onUpdateEmployeeImage });

    act(() => result.current.openAvatarModal(employee));
    act(() => result.current.handleImageUpload('https://example.com/photo.png'));

    expect(onUpdateEmployeeImage).toHaveBeenCalledWith(employee.id, 'https://example.com/photo.png');
    expect(result.current.showAvatarModal.open).toBe(false);
  });

  test('copy wallet notifies success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const employee = makeEmployee();
    const { result } = setup([employee]);

    await act(async () => {
      await result.current.handleCopyWallet(employee);
    });

    expect(writeText).toHaveBeenCalledWith(employee.wallet);
    expect(notifySuccess).toHaveBeenCalled();
  });
});
