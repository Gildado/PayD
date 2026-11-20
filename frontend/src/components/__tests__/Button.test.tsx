import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ArrowAnchor, ArrowButton, ArrowLink } from '../common/Button';

describe('arrow actions', () => {
  it('renders accessible trailing arrows for router and anchor links', () => {
    render(
      <MemoryRouter>
        <ArrowLink to="/payroll">View payroll</ArrowLink>
        <ArrowAnchor href="#details">View details</ArrowAnchor>
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'View payroll' })).toHaveClass('link-arrow');
    expect(screen.getByRole('link', { name: 'View details' })).toHaveClass('link-arrow');
    expect(document.querySelectorAll('.link-arrow-icon')).toHaveLength(2);
    expect(document.querySelectorAll('.link-arrow-icon[aria-hidden="true"]')).toHaveLength(2);
  });

  it('renders callback actions as buttons with a safe default type', () => {
    render(<ArrowButton>Learn more</ArrowButton>);

    expect(screen.getByRole('button', { name: 'Learn more' })).toHaveAttribute('type', 'button');
    expect(screen.getByRole('button', { name: 'Learn more' })).toHaveClass('link-arrow');
  });
});
