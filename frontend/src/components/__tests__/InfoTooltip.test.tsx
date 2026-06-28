import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { InfoTooltip } from '../InfoTooltip';

describe('InfoTooltip', () => {
  test('does not show tooltip content initially', () => {
    render(<InfoTooltip content="Test explanation" />);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  test('shows tooltip content on mouse enter', () => {
    render(<InfoTooltip content="ORGUSD is the org asset" label="What is ORGUSD?" />);
    const button = screen.getByRole('button', { name: 'What is ORGUSD?' });
    fireEvent.mouseEnter(button);
    expect(screen.getByRole('tooltip')).toBeTruthy();
    expect(screen.getByText('ORGUSD is the org asset')).toBeTruthy();
  });

  test('hides tooltip content on mouse leave', () => {
    render(<InfoTooltip content="ORGUSD is the org asset" label="What is ORGUSD?" />);
    const button = screen.getByRole('button', { name: 'What is ORGUSD?' });
    fireEvent.mouseEnter(button);
    fireEvent.mouseLeave(button);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  test('shows tooltip on focus and hides on blur', () => {
    render(<InfoTooltip content="Ledger explanation" label="What is a Ledger?" />);
    const button = screen.getByRole('button', { name: 'What is a Ledger?' });
    fireEvent.focus(button);
    expect(screen.getByRole('tooltip')).toBeTruthy();
    fireEvent.blur(button);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  test('uses default label when none provided', () => {
    render(<InfoTooltip content="Some info" />);
    expect(screen.getByRole('button', { name: 'More information' })).toBeTruthy();
  });
});
