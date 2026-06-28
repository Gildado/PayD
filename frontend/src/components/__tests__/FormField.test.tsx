import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormField } from '../FormField';

describe('FormField', () => {
  it('renders label correctly', () => {
    render(
      <FormField id="email" label="Email Address">
        <input type="email" />
      </FormField>
    );
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
  });

  it('shows required indicator', () => {
    render(
      <FormField id="name" label="Name" required={true}>
        <input type="text" />
      </FormField>
    );
    expect(screen.getByText('*')).toBeInTheDocument();
    expect(screen.getByText('(required)')).toBeInTheDocument();
  });

  it('shows optional indicator when specified', () => {
    render(
      <FormField id="middle" label="Middle Name" optional={true}>
        <input type="text" />
      </FormField>
    );
    expect(screen.getByText('(optional)')).toBeInTheDocument();
  });

  it('displays error message', () => {
    render(
      <FormField id="email" label="Email" error="Invalid email format">
        <input type="email" />
      </FormField>
    );
    expect(screen.getByText('Invalid email format')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  test('does not show required indicator when not required', () => {
    render(
      <FormField id="name" label="Name">
        <input type="text" />
      </FormField>
    );

    expect(screen.queryByText('(required)')).toBeNull();
  });

  test('sets aria-required on child input for required fields', () => {
    render(
      <FormField id="name" label="Name" required>
        <input type="text" />
      </FormField>
    );

    const input = screen.getByRole('textbox');
    expect(input.getAttribute('aria-required')).toBe('true');
  });

  test('displays error message and sets aria-invalid', () => {
    render(
      <FormField id="email" label="Email" error="Invalid email format">
        <input type="email" />
      </FormField>
    );

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Invalid email format')).toBeTruthy();

    const input = screen.getByRole('textbox');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  test('displays help text when no error', () => {
    render(
      <FormField id="email" label="Email" helpText="Enter your work email">
        <input type="email" />
      </FormField>
    );

    expect(screen.getByText('Enter your work email')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('error takes precedence over help text', () => {
    render(
      <FormField id="email" label="Email" error="Required field" helpText="Some help">
        <input type="email" />
      </FormField>
    );

    expect(screen.getByText('Required field')).toBeTruthy();
    expect(screen.queryByText('Some help')).toBeNull();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  test('does not set aria-invalid when no error', () => {
    render(
      <FormField id="email" label="Email">
        <input type="email" />
      </FormField>
    );

    const input = screen.getByRole('textbox');
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });

  test('applies custom className to wrapper', () => {
    const { container } = render(
      <FormField id="test" label="Test" className="custom-class">
        <input type="text" />
      </FormField>
    );

    expect(container.firstChild).toBeTruthy();
    expect((container.firstChild as HTMLElement).className).toContain('custom-class');
  });

  test('merges error classes with existing child className', () => {
    render(
      <FormField id="test" label="Test" error="Error message">
        <input type="text" className="existing-class" />
      </FormField>
    );

    const input = screen.getByRole('textbox');
    expect(input.className).toContain('existing-class');
    expect(input.className).toContain('border-[var(--danger)]');
  });

  test('connects error message via aria-describedby', () => {
    render(
      <FormField id="field" label="Field" error="Something went wrong">
        <input type="text" />
      </FormField>
    );

    const input = screen.getByRole('textbox');
    const errorEl = screen.getByRole('alert');

    expect(input.getAttribute('aria-describedby')).toBe(errorEl.getAttribute('id'));
  });

  test('connects help text via aria-describedby', () => {
    render(
      <FormField id="field" label="Field" helpText="Useful tip">
        <input type="text" />
      </FormField>
    );

    const input = screen.getByRole('textbox');
    const helpEl = screen.getByText('Useful tip');

    expect(input.getAttribute('aria-describedby')).toBe(helpEl.getAttribute('id'));
  });

  it('shows valid indicator when isValid prop is true', () => {
    const { container } = render(
      <FormField id="email" label="Email" isValid={true}>
        <input type="email" />
      </FormField>
    );
    const checkIcon = container.querySelector('[role="status"]');
    expect(checkIcon).toBeInTheDocument();
  });

  it('displays character count', () => {
    render(
      <FormField id="bio" label="Bio" maxLength={200} currentLength={85}>
        <textarea />
      </FormField>
    );
    expect(screen.getByText('85 / 200 characters')).toBeInTheDocument();
  });

  it('shows warning style when character count exceeds 80%', () => {
    render(
      <FormField id="bio" label="Bio" maxLength={100} currentLength={85}>
        <textarea />
      </FormField>
    );
    const charCount = screen.getByText('85 / 100 characters');
    expect(charCount).toHaveClass('text-amber-400');
  });

  it('does not show help text when error is present', () => {
    render(
      <FormField id="email" label="Email" error="Invalid" helpText="Enter a valid email">
        <input type="email" />
      </FormField>
    );
    expect(screen.queryByText('Enter a valid email')).not.toBeInTheDocument();
  });

  it('passes maxLength to input child', () => {
    const { container } = render(
      <FormField id="bio" label="Bio" maxLength={200}>
        <textarea />
      </FormField>
    );
    const textarea = container.querySelector('textarea');
    expect(textarea).toHaveAttribute('maxLength', '200');
  });
});
