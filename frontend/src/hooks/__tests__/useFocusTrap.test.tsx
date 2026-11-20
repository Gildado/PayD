import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useRef, useState } from 'react';
import { useFocusTrap } from '../useFocusTrap';

function TestModal({
  isOpen,
  onClose,
  initialFocusCancel = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialFocusCancel?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useFocusTrap(containerRef, {
    isOpen,
    onClose,
    initialFocusRef: initialFocusCancel ? cancelRef : undefined,
  });

  if (!isOpen) return null;

  return (
    <div ref={containerRef} role="dialog" aria-modal="true" tabIndex={-1}>
      <button type="button">First Action</button>
      <input type="text" placeholder="Name" />
      <button ref={cancelRef} type="button">
        Cancel
      </button>
      <button type="button">Confirm</button>
    </div>
  );
}

function TestContainer() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setIsOpen(true)}>
        Open Modal
      </button>
      <TestModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </div>
  );
}

describe('useFocusTrap', () => {
  it('focuses the first focusable element when opened', async () => {
    render(<TestContainer />);
    const user = userEvent.setup();

    const openBtn = screen.getByRole('button', { name: 'Open Modal' });
    await user.click(openBtn);

    const firstAction = screen.getByRole('button', { name: 'First Action' });
    expect(firstAction).toHaveFocus();
  });

  it('closes on Escape key press', async () => {
    const handleClose = vi.fn();
    render(<TestModal isOpen={true} onClose={handleClose} />);
    const user = userEvent.setup();

    await user.keyboard('{Escape}');
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('traps focus forward with Tab and wraps to first element', async () => {
    render(<TestModal isOpen={true} onClose={() => {}} />);
    const user = userEvent.setup();

    const firstBtn = screen.getByRole('button', { name: 'First Action' });
    const input = screen.getByRole('textbox');
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    const confirmBtn = screen.getByRole('button', { name: 'Confirm' });

    expect(firstBtn).toHaveFocus();

    await user.tab();
    expect(input).toHaveFocus();

    await user.tab();
    expect(cancelBtn).toHaveFocus();

    await user.tab();
    expect(confirmBtn).toHaveFocus();

    // Tab on last element should wrap to first
    await user.tab();
    expect(firstBtn).toHaveFocus();
  });

  it('traps focus backward with Shift+Tab and wraps to last element', async () => {
    render(<TestModal isOpen={true} onClose={() => {}} />);
    const user = userEvent.setup();

    const firstBtn = screen.getByRole('button', { name: 'First Action' });
    const confirmBtn = screen.getByRole('button', { name: 'Confirm' });

    expect(firstBtn).toHaveFocus();

    // Shift+Tab on first element should wrap to last
    await user.tab({ shift: true });
    expect(confirmBtn).toHaveFocus();
  });
});
