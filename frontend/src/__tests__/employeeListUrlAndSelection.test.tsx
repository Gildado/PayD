import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { EmployeeList, type Employee } from '../components/EmployeeList';
import { useEmployeeFilterState } from '../hooks/useFilterState';
import { renderHook, act } from '@testing-library/react';
import '../i18n';

vi.mock('../components/Avatar', () => ({
  Avatar: () => <div data-testid="avatar" />,
}));
vi.mock('../components/AvatarUpload', () => ({ AvatarUpload: () => null }));
vi.mock('../components/CSVUploader', () => ({ CSVUploader: () => null }));
vi.mock('../components/EmployeeRemovalConfirmModal', () => ({
  EmployeeRemovalConfirmModal: () => null,
}));
vi.mock('../hooks/useNotification', () => ({
  useNotification: () => ({ notifySuccess: vi.fn() }),
}));

function makeEmployees(count: number): Employee[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `emp-${i}`,
    name: `Employee ${String.fromCharCode(65 + (i % 26))} ${i}`,
    email: `employee${i}@example.com`,
    position: i % 2 === 0 ? 'Engineer' : 'Designer',
    salary: 5000 + i * 100,
    wallet: `GBTEST${i}WALLET`,
    status: (i % 3 === 0 ? 'Inactive' : 'Active') as 'Active' | 'Inactive',
  }));
}

describe('Issue #1853: EmployeeList URL persistence & safe fallback', () => {
  test('restores filter state, sort, and column visibility from URL search params', () => {
    const { result } = renderHook(() => useEmployeeFilterState(), {
      wrapper: ({ children }) => (
        <MemoryRouter
          initialEntries={[
            '/employees?search=alice&status=Active&sort=salary&order=desc&columns=name,salary',
          ]}
        >
          {children}
        </MemoryRouter>
      ),
    });

    expect(result.current.searchQuery).toBe('alice');
    expect(result.current.statusFilter).toBe('Active');
    expect(result.current.sortKey).toBe('salary');
    expect(result.current.sortAsc).toBe(false);
    expect(result.current.visibleColumns).toEqual(['name', 'salary']);
  });

  test('safely falls back to defaults when invalid query parameters are provided', () => {
    const { result } = renderHook(() => useEmployeeFilterState(), {
      wrapper: ({ children }) => (
        <MemoryRouter
          initialEntries={[
            '/employees?search=bob&status=UnknownStatus&sort=hackedCol&order=invalidOrder&columns=fake1,fake2',
          ]}
        >
          {children}
        </MemoryRouter>
      ),
    });

    // Invalid status defaults to 'All'
    expect(result.current.statusFilter).toBe('All');
    // Invalid sort key defaults to 'name'
    expect(result.current.sortKey).toBe('name');
    // Invalid sort order defaults to ascending (true)
    expect(result.current.sortAsc).toBe(true);
    // Invalid columns default to all columns
    expect(result.current.visibleColumns).toEqual([
      'name',
      'position',
      'wallet',
      'salary',
      'status',
    ]);
  });

  test('toggling column visibility updates visibleColumns state', () => {
    const { result } = renderHook(() => useEmployeeFilterState(), {
      wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    });

    act(() => {
      result.current.toggleColumn('salary');
    });

    expect(result.current.visibleColumns).not.toContain('salary');

    act(() => {
      result.current.toggleColumn('salary');
    });

    expect(result.current.visibleColumns).toContain('salary');
  });

  test('EmployeeList displays columns according to URL params', () => {
    const employees = makeEmployees(3);
    render(
      <MemoryRouter initialEntries={['/employees?columns=name,wallet']}>
        <EmployeeList employees={employees} onAddEmployee={vi.fn()} />
      </MemoryRouter>
    );

    // Name and wallet column headers should be present in the document
    expect(screen.getByRole('button', { name: /Sort.*Name/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sort.*Wallet/i })).toBeInTheDocument();
    // Role/position column header should be hidden
    expect(screen.queryByRole('button', { name: /Sort.*Role/i })).not.toBeInTheDocument();
  });
});

describe('Issue #1854: EmployeeList row selection announcements & range selection', () => {
  test('announces row selection count to screen readers in an aria-live region', async () => {
    const employees = makeEmployees(4);
    render(
      <MemoryRouter>
        <EmployeeList employees={employees} onAddEmployee={vi.fn()} />
      </MemoryRouter>
    );

    const announcement = screen.getByTestId('selection-announcement');
    expect(announcement).toHaveAttribute('aria-live', 'polite');
    expect(announcement).toHaveAttribute('role', 'status');

    // Select first row checkbox inside desktop table row
    const rows = screen.getAllByTestId('employee-table-row');
    const firstCheckbox = within(rows[0]).getByRole('checkbox', { name: /select/i });
    fireEvent.click(firstCheckbox);

    await waitFor(() => {
      expect(announcement.textContent).toMatch(/1 employee selected/i);
    });

    // Unselect first row
    fireEvent.click(firstCheckbox);

    await waitFor(() => {
      expect(announcement.textContent).toMatch(/no employees selected/i);
    });
  });

  test('shift-click selects contiguous range of rows', async () => {
    const employees = makeEmployees(5);
    render(
      <MemoryRouter>
        <EmployeeList employees={employees} onAddEmployee={vi.fn()} />
      </MemoryRouter>
    );

    const rows = screen.getAllByTestId('employee-table-row');
    const checkbox0 = within(rows[0]).getByRole('checkbox', { name: /select/i });
    const checkbox2 = within(rows[2]).getByRole('checkbox', { name: /select/i });

    // Click row 0
    fireEvent.click(checkbox0);

    // Shift-click row 2 (should select rows 0, 1, 2)
    fireEvent.click(checkbox2, { shiftKey: true });

    const announcement = screen.getByTestId('selection-announcement');
    await waitFor(() => {
      expect(announcement.textContent).toMatch(/3 employees selected/i);
    });
  });

  test('select all checkbox selects and announces all rows', async () => {
    const employees = makeEmployees(3);
    render(
      <MemoryRouter>
        <EmployeeList employees={employees} onAddEmployee={vi.fn()} />
      </MemoryRouter>
    );

    const selectAllCheckbox = screen.getByRole('checkbox', { name: /select all employees/i });
    fireEvent.click(selectAllCheckbox);

    const announcement = screen.getByTestId('selection-announcement');
    await waitFor(() => {
      expect(announcement.textContent).toMatch(/all 3 employees selected/i);
    });
  });

  test('keyboard selection using space key on focused row toggles selection', async () => {
    const employees = makeEmployees(3);
    render(
      <MemoryRouter>
        <EmployeeList employees={employees} onAddEmployee={vi.fn()} />
      </MemoryRouter>
    );

    const rows = screen.getAllByTestId('employee-table-row');
    rows[0].focus();

    // Press Space on row
    fireEvent.keyDown(rows[0], { key: ' ' });

    const announcement = screen.getByTestId('selection-announcement');
    await waitFor(() => {
      expect(announcement.textContent).toMatch(/1 employee selected/i);
    });
  });
});
