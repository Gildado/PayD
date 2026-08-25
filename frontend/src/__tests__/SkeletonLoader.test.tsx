import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SkeletonLoader } from '../components/SkeletonLoader';

describe('SkeletonLoader Component', () => {
  it('applies skeleton-shimmer class across variants', () => {
    const { container } = render(
      <div>
        <SkeletonLoader variant="text" count={2} />
        <SkeletonLoader variant="card" height={24} />
        <SkeletonLoader variant="avatar" size={32} />
      </div>
    );

    const shimmerElements = container.querySelectorAll('.skeleton-shimmer');
    expect(shimmerElements.length).toBe(4);
  });

  it('renders accessibility presentation attributes', () => {
    const { container } = render(<SkeletonLoader variant="badge" />);
    const badge = container.firstElementChild;
    expect(badge).toHaveAttribute('role', 'presentation');
    expect(badge).toHaveAttribute('aria-hidden', 'true');
  });
});
