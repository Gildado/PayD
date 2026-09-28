import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SocialIdentityManager } from '../SocialIdentityManager';

describe('SocialIdentityManager', () => {
  const mockIdentities = [
    {
      provider: 'google' as const,
      email: 'user@gmail.com',
      displayName: 'John Doe',
      connectedAt: '2026-05-31',
      isPrimary: true,
    },
  ];

  it('renders linked identities', () => {
    render(
      <SocialIdentityManager
        identities={mockIdentities}
        onLinkProvider={() => {}}
        onUnlinkProvider={() => {}}
      />
    );
    expect(screen.getByText('Connected Accounts')).toBeInTheDocument();
    expect(screen.getByText('Google')).toBeInTheDocument();
    expect(screen.getByText('user@gmail.com')).toBeInTheDocument();
  });

  it('shows primary account indicator', () => {
    render(
      <SocialIdentityManager
        identities={mockIdentities}
        onLinkProvider={() => {}}
        onUnlinkProvider={() => {}}
      />
    );
    expect(screen.getByText('Primary')).toBeInTheDocument();
  });

  it('shows linked account connection date', () => {
    render(
      <SocialIdentityManager
        identities={mockIdentities}
        onLinkProvider={() => {}}
        onUnlinkProvider={() => {}}
      />
    );
    // The component renders "Connected {date.toLocaleDateString()}"
    expect(screen.getByText(/Connected\s+\d/)).toBeInTheDocument();
  });

  it('shows available providers to link', () => {
    render(<SocialIdentityManager identities={mockIdentities} onLinkProvider={() => {}} />);
    expect(screen.getByText('Link Additional Accounts')).toBeInTheDocument();
    expect(screen.getByText(/Link GitHub/)).toBeInTheDocument();
  });

  it('calls onLinkProvider when link button clicked', async () => {
    const user = userEvent.setup();
    const onLinkProvider = vi.fn();
    render(<SocialIdentityManager identities={mockIdentities} onLinkProvider={onLinkProvider} />);

    const linkButton = screen.getByLabelText('Link GitHub account');
    await user.click(linkButton);
    expect(onLinkProvider).toHaveBeenCalledWith('github');
  });

  it('shows unlink button for non-primary accounts', async () => {
    const identities = [
      { provider: 'google' as const, email: 'user@gmail.com' },
      { provider: 'github' as const, email: 'user@github.com', isPrimary: true },
    ];
    render(<SocialIdentityManager identities={identities} onUnlinkProvider={() => {}} />);
    const unlinkButton = screen.getByLabelText('Unlink Google account');
    expect(unlinkButton).toBeInTheDocument();
  });

  it('shows confirmation dialog for unlink', async () => {
    const user = userEvent.setup();
    const onUnlink = vi.fn();
    const identities = [
      { provider: 'google' as const, email: 'user@gmail.com' },
      { provider: 'github' as const, email: 'user@github.com', isPrimary: true },
    ];
    render(<SocialIdentityManager identities={identities} onUnlinkProvider={onUnlink} />);

    const unlinkButton = screen.getByLabelText('Unlink Google account');
    await user.click(unlinkButton);
    expect(screen.getByText('Unlink Account?')).toBeInTheDocument();
  });

  it('calls onUnlinkProvider when confirmed', async () => {
    const user = userEvent.setup();
    const onUnlink = vi.fn();
    const identities = [
      { provider: 'google' as const, email: 'user@gmail.com' },
      { provider: 'github' as const, email: 'user@github.com', isPrimary: true },
    ];
    render(<SocialIdentityManager identities={identities} onUnlinkProvider={onUnlink} />);

    const unlinkButton = screen.getByLabelText('Unlink Google account');
    await user.click(unlinkButton);

    const confirmButton = screen.getByRole('button', { name: 'Unlink' });
    await user.click(confirmButton);
    expect(onUnlink).toHaveBeenCalledWith('google');
  });

  it('prevents unlink when only one account linked', () => {
    render(<SocialIdentityManager identities={mockIdentities} onUnlinkProvider={() => {}} />);
    expect(screen.getByText('One account remaining')).toBeInTheDocument();
  });

  it('disables unlink button when isLoading is true', () => {
    render(
      <SocialIdentityManager
        identities={mockIdentities}
        isLoading={true}
        onUnlinkProvider={() => {}}
      />
    );
    // The button should still be in the DOM but disabled via pointer-events
    const buttons = screen.getAllByRole('button');
    buttons.forEach((button) => {
      if (button.getAttribute('aria-label')?.includes('Unlink')) {
        expect(button).toHaveAttribute('disabled');
      }
    });
  });

  it('shows set as primary option for non-primary accounts', async () => {
    const identities = [
      { provider: 'google' as const, email: 'user@gmail.com', isPrimary: true },
      { provider: 'github' as const, email: 'user@github.com' },
    ];
    render(<SocialIdentityManager identities={identities} onSetPrimary={() => {}} />);
    expect(screen.getByText('Set Primary')).toBeInTheDocument();
  });

  it('calls onSetPrimary when set primary clicked', async () => {
    const user = userEvent.setup();
    const onSetPrimary = vi.fn();
    const identities = [
      { provider: 'google' as const, email: 'user@gmail.com', isPrimary: true },
      { provider: 'github' as const, email: 'user@github.com' },
    ];
    render(<SocialIdentityManager identities={identities} onSetPrimary={onSetPrimary} />);

    const setPrimaryButton = screen.getByText('Set Primary');
    await user.click(setPrimaryButton);
    expect(onSetPrimary).toHaveBeenCalledWith('github');
  });

  it('applies custom className', () => {
    const { container } = render(
      <SocialIdentityManager identities={mockIdentities} className="custom-class" />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
