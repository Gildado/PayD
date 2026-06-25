import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PaginationControls } from '../PaginationControls';
import userEvent from '@testing-library/user-event';

describe('PaginationControls', () => {
  it('does not render for single page', () => {
    const { container } = render(
      <PaginationControls currentPage={1} totalPages={1} onPageChange={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('displays current page and total pages', () => {
    render(<PaginationControls currentPage={2} totalPages={5} onPageChange={() => {}} />);
    // The component renders "Page X of Y" with spans around the numbers
    expect(screen.getAllByText(/Page 2 of 5/).length).toBeGreaterThan(0);
    expect(
      screen.getByText((_, el) => el?.textContent === '2' && el.tagName === 'SPAN')
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, el) => el?.textContent === '5' && el.tagName === 'SPAN')
    ).toBeInTheDocument();
  });

  it('calls onPageChange with correct page number', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<PaginationControls currentPage={1} totalPages={5} onPageChange={onPageChange} />);

    const page2Button = screen.getByRole('button', { name: /Go to page 2/i });
    await user.click(page2Button);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('disables previous button on first page', () => {
    render(<PaginationControls currentPage={1} totalPages={5} onPageChange={() => {}} />);
    const prevButton = screen.getByLabelText('Go to previous page');
    expect(prevButton).toBeDisabled();
  });

  it('disables next button on last page', () => {
    render(<PaginationControls currentPage={5} totalPages={5} onPageChange={() => {}} />);
    const nextButton = screen.getByLabelText('Go to next page');
    expect(nextButton).toBeDisabled();
  });

  it('shows first/last buttons when showFirstLast is true', () => {
    render(
      <PaginationControls
        currentPage={2}
        totalPages={5}
        onPageChange={() => {}}
        showFirstLast={true}
      />
    );
    expect(screen.getByLabelText('Go to first page')).toBeInTheDocument();
    expect(screen.getByLabelText('Go to last page')).toBeInTheDocument();
  });

  it('hides first/last buttons when showFirstLast is false', () => {
    render(
      <PaginationControls
        currentPage={2}
        totalPages={5}
        onPageChange={() => {}}
        showFirstLast={false}
      />
    );
    expect(screen.queryByLabelText('Go to first page')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Go to last page')).not.toBeInTheDocument();
  });

  it('shows ellipsis for skipped pages', () => {
    render(
      <PaginationControls
        currentPage={1}
        totalPages={10}
        onPageChange={() => {}}
        maxVisiblePages={5}
      />
    );
    const ellipses = screen.getAllByText('…');
    expect(ellipses.length).toBeGreaterThan(0);
  });

  it('marks current page with aria-current', () => {
    render(<PaginationControls currentPage={3} totalPages={5} onPageChange={() => {}} />);
    const currentPageButton = screen.getByLabelText('Go to page 3');
    expect(currentPageButton).toHaveAttribute('aria-current', 'page');
  });

  it('disables all buttons when disabled prop is true', () => {
    render(
      <PaginationControls currentPage={2} totalPages={5} onPageChange={() => {}} disabled={true} />
    );
    const buttons = screen.getAllByRole('button');
    // All buttons should be disabled — the component disables via the disabled prop
    buttons.forEach((button) => {
      expect(button).toBeDisabled();
    });
  });

  it('has correct navigation semantic role', () => {
    render(<PaginationControls currentPage={1} totalPages={5} onPageChange={() => {}} />);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });
});
