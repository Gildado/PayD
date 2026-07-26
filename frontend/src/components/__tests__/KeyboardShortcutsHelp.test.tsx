import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { KeyboardShortcutsHelp } from '../KeyboardShortcutsHelp';
import type { KeyboardShortcut } from '../../hooks/useKeyboardShortcuts';

const shortcuts: KeyboardShortcut[] = [
  { id: 'search', key: 'k', description: 'Search documentation', action: () => {} },
  { id: 'new-payroll', key: 'n', description: 'Create a new payroll', action: () => {} },
];

describe('KeyboardShortcutsHelp', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <KeyboardShortcutsHelp
        isOpen={false}
        shortcuts={shortcuts}
        enabled={true}
        onSetEnabled={() => {}}
        onClose={() => {}}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('lists every shortcut with its description', () => {
    render(
      <KeyboardShortcutsHelp
        isOpen={true}
        shortcuts={shortcuts}
        enabled={true}
        onSetEnabled={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByText('Search documentation')).toBeInTheDocument();
    expect(screen.getByText('Create a new payroll')).toBeInTheDocument();
    expect(screen.getByText('Show this help')).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <KeyboardShortcutsHelp
        isOpen={true}
        shortcuts={shortcuts}
        enabled={true}
        onSetEnabled={() => {}}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(
      <KeyboardShortcutsHelp
        isOpen={true}
        shortcuts={shortcuts}
        enabled={true}
        onSetEnabled={() => {}}
        onClose={onClose}
      />
    );
    const backdrop = container.querySelector('[role="presentation"]');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('reflects the enabled preference in the toggle checkbox', () => {
    render(
      <KeyboardShortcutsHelp
        isOpen={true}
        shortcuts={shortcuts}
        enabled={false}
        onSetEnabled={() => {}}
        onClose={() => {}}
      />
    );
    const checkbox = screen.getByLabelText('Enable keyboard shortcuts');
    expect(checkbox.checked).toBe(false);
  });

  it('calls onSetEnabled when the toggle is switched', () => {
    const onSetEnabled = vi.fn();
    render(
      <KeyboardShortcutsHelp
        isOpen={true}
        shortcuts={shortcuts}
        enabled={true}
        onSetEnabled={onSetEnabled}
        onClose={() => {}}
      />
    );
    fireEvent.click(screen.getByLabelText('Enable keyboard shortcuts'));
    expect(onSetEnabled).toHaveBeenCalledWith(false);
  });
});
