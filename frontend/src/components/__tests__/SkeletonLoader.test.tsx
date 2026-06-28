import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SkeletonLoader } from '../SkeletonLoader';

describe('SkeletonLoader', () => {
  describe('text variant', () => {
    it('renders a single line by default', () => {
      const { container } = render(<SkeletonLoader variant="text" />);
      const spans = container.querySelectorAll('span[aria-hidden="true"]');
      expect(spans).toHaveLength(1);
    });

    it('renders the requested count of lines', () => {
      const { container } = render(<SkeletonLoader variant="text" count={4} />);
      const spans = container.querySelectorAll('span[aria-hidden="true"]');
      expect(spans).toHaveLength(4);
    });

    it('applies the full width class by default', () => {
      const { container } = render(<SkeletonLoader variant="text" />);
      expect(container.firstChild).toHaveClass('w-full');
    });

    it('applies the correct width class for 1/2', () => {
      const { container } = render(<SkeletonLoader variant="text" width="1/2" />);
      expect(container.firstChild).toHaveClass('w-1/2');
    });

    it('has aria-hidden on every element', () => {
      const { container } = render(<SkeletonLoader variant="text" count={3} />);
      const spans = container.querySelectorAll('[aria-hidden="true"]');
      expect(spans).toHaveLength(3);
    });

    it('applies the animate-pulse class', () => {
      const { container } = render(<SkeletonLoader variant="text" />);
      expect(container.firstChild).toHaveClass('animate-pulse');
    });
  });

  describe('card variant', () => {
    it('renders a single card by default', () => {
      const { container } = render(<SkeletonLoader variant="card" />);
      const cards = container.querySelectorAll('div[aria-hidden="true"]');
      expect(cards).toHaveLength(1);
    });

    it('renders multiple cards when count > 1', () => {
      const { container } = render(<SkeletonLoader variant="card" count={2} />);
      const cards = container.querySelectorAll('div[aria-hidden="true"]');
      expect(cards).toHaveLength(2);
    });

    it('applies provided height in pixels', () => {
      const { container } = render(<SkeletonLoader variant="card" height={48} />);
      const card = container.querySelector('div[aria-hidden="true"]') as HTMLElement;
      expect(card.style.height).toBe('192px'); // 48 * 4
    });
  });

  describe('table-row variant', () => {
    it('renders inside a table context', () => {
      const { container } = render(
        <table>
          <tbody>
            <SkeletonLoader variant="table-row" count={2} columns={3} />
          </tbody>
        </table>
      );
      const rows = container.querySelectorAll('tr[aria-hidden="true"]');
      expect(rows).toHaveLength(2);
    });

    it('renders the correct number of columns per row', () => {
      const { container } = render(
        <table>
          <tbody>
            <SkeletonLoader variant="table-row" count={1} columns={5} />
          </tbody>
        </table>
      );
      const cells = container.querySelectorAll('td');
      expect(cells).toHaveLength(5);
    });

    it('renders the total cell count across multiple rows (data-table layout)', () => {
      // Mirrors the 8-column bulk-payment / 6-column freeze-log tables that now
      // render skeleton rows while loading.
      const { container } = render(
        <table>
          <tbody>
            <SkeletonLoader variant="table-row" count={5} columns={8} />
          </tbody>
        </table>
      );
      expect(container.querySelectorAll('tr[aria-hidden="true"]')).toHaveLength(5);
      expect(container.querySelectorAll('td')).toHaveLength(40);
    });

    it('keeps placeholder rows hidden from assistive tech', () => {
      const { container } = render(
        <table>
          <tbody>
            <SkeletonLoader variant="table-row" count={3} columns={4} />
          </tbody>
        </table>
      );
      container.querySelectorAll('tr').forEach((row) => {
        expect(row.getAttribute('aria-hidden')).toBe('true');
        expect(row.textContent).toBe('');
      });
    });
  });

  describe('avatar variant', () => {
    it('renders a rounded-full skeleton', () => {
      const { container } = render(<SkeletonLoader variant="avatar" />);
      const avatar = container.querySelector('span[aria-hidden="true"]');
      expect(avatar).toHaveClass('rounded-full');
    });

    it('applies custom size via inline style', () => {
      const { container } = render(<SkeletonLoader variant="avatar" size={64} />);
      const avatar = container.querySelector('span[aria-hidden="true"]') as HTMLElement;
      expect(avatar.style.width).toBe('64px');
      expect(avatar.style.height).toBe('64px');
    });
  });

  describe('badge variant', () => {
    it('renders a badge-shaped skeleton', () => {
      const { container } = render(<SkeletonLoader variant="badge" />);
      const badge = container.querySelector('span[aria-hidden="true"]');
      expect(badge).toHaveClass('rounded-full');
      expect(badge).toHaveClass('h-5');
    });
  });

  describe('chart variant', () => {
    it('renders a chart placeholder', () => {
      const { container } = render(<SkeletonLoader variant="chart" height={300} />);
      const chart = container.querySelector('div[aria-hidden="true"]') as HTMLElement;
      expect(chart.style.height).toBe('300px');
    });
  });

  describe('accessibility', () => {
    it('all elements have aria-hidden=true', () => {
      const { container } = render(
        <>
          <SkeletonLoader variant="text" count={2} />
          <SkeletonLoader variant="badge" />
        </>
      );
      const elements = container.querySelectorAll('[aria-hidden="true"]');
      expect(elements.length).toBeGreaterThan(0);
      elements.forEach((el) => {
        expect(el.getAttribute('aria-hidden')).toBe('true');
      });
    });

    it('no element has a visible text content', () => {
      const { container } = render(<SkeletonLoader variant="text" count={3} />);
      container.querySelectorAll('[aria-hidden="true"]').forEach((el) => {
        expect(el.textContent).toBe('');
      });
    });
  });
});
