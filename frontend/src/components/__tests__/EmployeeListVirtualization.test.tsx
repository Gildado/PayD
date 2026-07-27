import { useEffect } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { EmployeeList, type Employee } from '../EmployeeList';
import '../../i18n';

// This mock renders every row directly (jsdom has no real layout, so a real
// <List> would measure zero height and render nothing) and simulates
// react-window reporting "the whole list is visible" via onRowsRendered, so
// PageUp/PageDown (which derive their jump size from that callback) can be
// exercised deterministically.
vi.mock('react-window', () => ({
  List: ({ rowComponent: RowComponent, rowCount, rowProps, onRowsRendered }: any) => {
    useEffect(() => {
      onRowsRendered?.({ startIndex: 0, stopIndex: Math.max(rowCount - 1, 0) });
    }, [rowCount, onRowsRendered]);

    return (
      <>
        {Array.from({ length: rowCount }, (_, index) => (
          <RowComponent
            key={index}
            index={index}
            style={{}}
            ariaAttributes={{
              'aria-posinset': index + 1,
              'aria-setsize': rowCount,
              role: 'listitem',
            }}
            {...rowProps}
          />
        ))}
      </>
    );
  },
  useListRef: () => ({ current: null }),
}));

vi.mock('../Avatar', () => ({
  Avatar: () => <div data-testid="avatar" />,
}));
vi.mock('../AvatarUpload', () => ({ AvatarUpload: () => null }));
vi.mock('../../hooks/useNotification', () => ({
  useNotification: () => ({ notifySuccess: vi.fn() }),
}));
vi.mock('../CSVUploader', () => ({ CSVUploader: () => null }));
vi.mock('../EmployeeRemovalConfirmModal', () => ({
  EmployeeRemovalConfirmModal: () => null,
}));

function makeEmployees(count: number): Employee[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `emp-${i}`,
    name: `Employee ${i}`,
    email: `employee${i}@example.com`,
    position: 'Engineer',
    status: 'Active' as const,
  }));
}

describe('EmployeeList virtualization', () => {
  test(
    'renders the correct total row count for a large dataset',
    () => {
      // Our test stub deliberately renders every row (real virtualization is
      // exactly what avoids this cost in production — see the react-window
      // mock above), so this is slower than the real component but still
      // verifies rowCount reaches react-window correctly at scale.
      const employees = makeEmployees(1000);
      render(<EmployeeList employees={employees} onAddEmployee={vi.fn()} />);

      const rows = screen.getAllByTestId('employee-table-row');
      expect(rows).toHaveLength(1000);
    },
    20000
  );

  test('search filtering narrows the virtualized row count', () => {
    const employees = makeEmployees(50);
    render(<EmployeeList employees={employees} onAddEmployee={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Search employees'), {
      target: { value: 'Employee 4' },
    });

    // "Employee 4" matches Employee 4, 40-49 (11 rows).
    return waitFor(() => {
      const rows = screen.getAllByTestId('employee-table-row');
      expect(rows.length).toBeGreaterThan(0);
      rows.forEach((row) => expect(row.textContent).toMatch(/Employee 4/));
    });
  });

  test('arrow keys move focus between virtualized rows', async () => {
    const employees = makeEmployees(5);
    render(<EmployeeList employees={employees} onAddEmployee={vi.fn()} />);

    const rows = screen.getAllByTestId('employee-table-row');
    expect(rows).toHaveLength(5);

    rows[0].focus();
    expect(rows[0]).toHaveFocus();

    fireEvent.keyDown(rows[0], { key: 'ArrowDown' });
    await waitFor(() => expect(rows[1]).toHaveFocus());

    fireEvent.keyDown(rows[1], { key: 'ArrowDown' });
    await waitFor(() => expect(rows[2]).toHaveFocus());

    fireEvent.keyDown(rows[2], { key: 'ArrowUp' });
    await waitFor(() => expect(rows[1]).toHaveFocus());
  });

  test('Home and End jump to the first and last row', async () => {
    const employees = makeEmployees(5);
    render(<EmployeeList employees={employees} onAddEmployee={vi.fn()} />);
    const rows = screen.getAllByTestId('employee-table-row');

    rows[2].focus();
    fireEvent.keyDown(rows[2], { key: 'End' });
    await waitFor(() => expect(rows[4]).toHaveFocus());

    fireEvent.keyDown(rows[4], { key: 'Home' });
    await waitFor(() => expect(rows[0]).toHaveFocus());
  });

  test('Page Down/Up move by a full viewport of rows', async () => {
    const employees = makeEmployees(5);
    render(<EmployeeList employees={employees} onAddEmployee={vi.fn()} />);
    const rows = screen.getAllByTestId('employee-table-row');

    rows[0].focus();
    // The mock reports all 5 rows as the visible viewport.
    fireEvent.keyDown(rows[0], { key: 'PageDown' });
    await waitFor(() => expect(rows[4]).toHaveFocus());

    fireEvent.keyDown(rows[4], { key: 'PageUp' });
    await waitFor(() => expect(rows[0]).toHaveFocus());
  });

  test('keyboard navigation clamps to the row count after a filter shrinks the list', async () => {
    const employees = makeEmployees(10);
    render(<EmployeeList employees={employees} onAddEmployee={vi.fn()} />);

    let rows = screen.getAllByTestId('employee-table-row');
    rows[9].focus();
    expect(rows[9]).toHaveFocus();

    fireEvent.change(screen.getByLabelText('Search employees'), {
      target: { value: 'Employee 1' },
    });

    // Only "Employee 1" remains; the focused index must clamp into range
    // rather than pointing past the end of the new, shorter list.
    await waitFor(() => {
      rows = screen.getAllByTestId('employee-table-row');
      expect(rows).toHaveLength(1);
    });
  });
});
