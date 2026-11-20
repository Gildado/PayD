import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  CardListSkeleton,
  ChartPanelSkeleton,
  DashboardSkeleton,
  StatCardsSkeleton,
  TableSkeleton,
} from '../DataSkeletons';

describe('DataSkeletons (#1501)', () => {
  it('announces a single busy status with the given label', () => {
    render(<TableSkeleton label="Loading employees" />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveTextContent('Loading employees');
  });

  it('hides placeholder shapes from assistive tech', () => {
    const { container } = render(<CardListSkeleton count={2} />);
    const shapes = container.querySelectorAll('.skeleton-shimmer');
    expect(shapes.length).toBeGreaterThan(0);
    shapes.forEach((shape) => expect(shape.closest('[aria-hidden="true"]')).not.toBeNull());
  });

  it('renders a header plus the requested number of table rows', () => {
    const { container } = render(<TableSkeleton rows={3} columns={5} />);
    const grids = container.querySelectorAll('.grid');
    expect(grids).toHaveLength(4);
    expect(grids[1].children).toHaveLength(5);
  });

  it('renders an avatar in the first column when requested', () => {
    const { container } = render(<TableSkeleton rows={1} withAvatar />);
    expect(container.querySelector('.rounded-full.h-9.w-9')).not.toBeNull();
  });

  it('renders the requested number of stat and list cards', () => {
    const { container: stats } = render(<StatCardsSkeleton count={3} />);
    expect(stats.querySelectorAll('.skeleton-surface')).toHaveLength(3);

    const { container: list } = render(<CardListSkeleton count={4} />);
    expect(list.querySelectorAll('.skeleton-surface')).toHaveLength(4);
  });

  it('renders chart and dashboard composites with default labels', () => {
    render(
      <>
        <ChartPanelSkeleton />
        <DashboardSkeleton />
      </>
    );
    expect(screen.getByText('Loading chart')).toBeInTheDocument();
    expect(screen.getByText('Loading dashboard')).toBeInTheDocument();
  });
});
