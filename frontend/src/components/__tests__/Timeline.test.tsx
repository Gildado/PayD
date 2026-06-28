import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Timeline, type TimelineItem } from '../Timeline';

describe('Timeline', () => {
  const mockItems: TimelineItem[] = [
    {
      id: '1',
      label: 'Started',
      description: 'Process has begun',
      status: 'completed',
      timestamp: '10:00 AM',
    },
    {
      id: '2',
      label: 'Processing',
      description: 'Currently processing',
      status: 'current',
      timestamp: '10:15 AM',
    },
    {
      id: '3',
      label: 'Pending',
      status: 'pending',
    },
  ];

  it('renders all timeline items', () => {
    render(<Timeline items={mockItems} />);
    expect(screen.getByText('Started')).toBeInTheDocument();
    expect(screen.getByText('Processing')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('renders item descriptions', () => {
    render(<Timeline items={mockItems} />);
    expect(screen.getByText('Process has begun')).toBeInTheDocument();
    expect(screen.getByText('Currently processing')).toBeInTheDocument();
  });

  it('renders item timestamps', () => {
    render(<Timeline items={mockItems} />);
    expect(screen.getByText('10:00 AM')).toBeInTheDocument();
    expect(screen.getByText('10:15 AM')).toBeInTheDocument();
  });

  it('renders in vertical layout by default', () => {
    const { container } = render(<Timeline items={mockItems} />);
    const timeline = container.querySelector('ol');
    expect(timeline).toBeInTheDocument();
    expect(timeline).toHaveClass('border-l-2');
  });

  it('renders in horizontal layout when specified', () => {
    const { container } = render(<Timeline items={mockItems} direction="horizontal" />);
    // The outer div has `w-full`, the inner div has `flex items-start gap-4 ...`
    const flexContainer = container.querySelector('.flex.items-start');
    expect(flexContainer).toBeInTheDocument();
    expect(flexContainer).toHaveClass('flex');
  });

  it('applies custom className', () => {
    const { container } = render(<Timeline items={mockItems} className="custom-class" />);
    // For vertical layout, className is applied directly; for horizontal, it's on the wrapper div
    const firstChild = container.firstChild;
    expect(firstChild).toHaveClass('custom-class');
  });

  it('handles empty items array', () => {
    const { container } = render(<Timeline items={[]} />);
    expect(container.querySelector('ol')).toBeInTheDocument();
  });

  it('renders items with different status types', () => {
    const items: TimelineItem[] = [
      { id: '1', label: 'Completed', status: 'completed' },
      { id: '2', label: 'Current', status: 'current' },
      { id: '3', label: 'Pending', status: 'pending' },
      { id: '4', label: 'Error', status: 'error' },
    ];

    render(<Timeline items={items} />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('has proper semantic structure', () => {
    render(<Timeline items={mockItems} />);
    const list = screen.getByRole('list');
    expect(list.tagName).toBe('OL');

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
  });

  it('renders without timestamps if not provided', () => {
    const items: TimelineItem[] = [
      {
        id: '1',
        label: 'Item 1',
        status: 'completed',
      },
    ];

    render(<Timeline items={items} />);
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.queryByRole('time')).not.toBeInTheDocument();
  });
});
