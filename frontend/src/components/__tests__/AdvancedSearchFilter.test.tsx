import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdvancedSearchFilter, type SearchFilters } from '../AdvancedSearchFilter';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

describe('AdvancedSearchFilter', () => {
  const mockOnFiltersChange = vi.fn();

  const defaultFilters: SearchFilters = {
    status: 'All',
    sortBy: 'name',
    sortOrder: 'asc',
  };

  const defaultProps = {
    filters: defaultFilters,
    onFiltersChange: mockOnFiltersChange,
    departments: ['Engineering', 'Marketing', 'Sales'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders collapsed by default', () => {
    render(<AdvancedSearchFilter {...defaultProps} />);

    expect(screen.getByText('Advanced Filters')).toBeInTheDocument();
    expect(screen.queryByLabelText(/search.filterByStatus/i)).not.toBeInTheDocument();
  });

  it('expands when clicked', () => {
    render(<AdvancedSearchFilter {...defaultProps} />);

    const expandButton = screen.getByText('Advanced Filters');
    fireEvent.click(expandButton);

    expect(screen.getByLabelText(/search.filterByStatus/i)).toBeInTheDocument();
  });

  it('shows active indicator when filters are applied', () => {
    const activeFilters: SearchFilters = {
      ...defaultFilters,
      status: 'Active',
      minSalary: 1000,
    };

    render(<AdvancedSearchFilter {...defaultProps} filters={activeFilters} />);

    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('calls onFiltersChange when status filter changes', () => {
    render(<AdvancedSearchFilter {...defaultProps} />);

    const expandButton = screen.getByText('Advanced Filters');
    fireEvent.click(expandButton);

    const statusSelect = screen.getByLabelText(/search.filterByStatus/i);
    fireEvent.change(statusSelect, { target: { value: 'Active' } });

    expect(mockOnFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'Active' }));
  });

  it('calls onFiltersChange when salary range changes', () => {
    render(<AdvancedSearchFilter {...defaultProps} />);

    const expandButton = screen.getByText('Advanced Filters');
    fireEvent.click(expandButton);

    const minSalaryInput = screen.getByLabelText(/search.minSalary/i);
    fireEvent.change(minSalaryInput, { target: { value: '1000' } });

    expect(mockOnFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ minSalary: 1000 }));
  });

  it('resets filters when reset button is clicked', () => {
    const activeFilters: SearchFilters = {
      status: 'Active',
      minSalary: 1000,
      maxSalary: 5000,
      sortBy: 'salary',
      sortOrder: 'desc',
    };

    render(<AdvancedSearchFilter {...defaultProps} filters={activeFilters} />);

    const resetButton = screen.getByText(/search.resetFilters/i);
    fireEvent.click(resetButton);

    expect(mockOnFiltersChange).toHaveBeenCalledWith({
      status: 'All',
      department: undefined,
      minSalary: undefined,
      maxSalary: undefined,
      sortBy: 'name',
      sortOrder: 'asc',
    });
  });

  it('renders department filter when departments are provided', () => {
    render(<AdvancedSearchFilter {...defaultProps} />);

    const expandButton = screen.getByText('Advanced Filters');
    fireEvent.click(expandButton);

    expect(screen.getByLabelText(/search.filterByDepartment/i)).toBeInTheDocument();
  });

  it('does not render department filter when no departments provided', () => {
    render(<AdvancedSearchFilter {...defaultProps} departments={[]} />);

    const expandButton = screen.getByText('Advanced Filters');
    fireEvent.click(expandButton);

    expect(screen.queryByLabelText(/search.filterByDepartment/i)).not.toBeInTheDocument();
  });

  it('handles sort by changes', () => {
    render(<AdvancedSearchFilter {...defaultProps} />);

    const expandButton = screen.getByText('Advanced Filters');
    fireEvent.click(expandButton);

    const sortBySelect = screen.getByLabelText(/search.sortBy/i);
    fireEvent.change(sortBySelect, { target: { value: 'salary' } });

    expect(mockOnFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ sortBy: 'salary' }));
  });

  it('handles sort order changes', () => {
    render(<AdvancedSearchFilter {...defaultProps} />);

    const expandButton = screen.getByText('Advanced Filters');
    fireEvent.click(expandButton);

    const sortOrderSelect = screen.getByLabelText(/Order/i);
    fireEvent.change(sortOrderSelect, { target: { value: 'desc' } });

    expect(mockOnFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ sortOrder: 'desc' })
    );
  });
});
