import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConnectedProvidersStatus } from '../ConnectedProvidersStatus';
import type { ConnectedProvider } from '../ConnectedProvidersStatus';

const providersMock: ConnectedProvider[] = [
  {
    provider: 'google',
    isConnected: true,
    email: 'user@example.com',
    connectedAt: '2024-01-01T12:00:00Z',
  },
  { provider: 'github', isConnected: false },
];

describe('ConnectedProvidersStatus', () => {
  it('renders connected and disconnected providers', () => {
    render(<ConnectedProvidersStatus providers={providersMock} />);
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
    expect(screen.getByText('Not connected')).toBeInTheDocument();
  });

  it('shows status indicators for connected provider', () => {
    render(<ConnectedProvidersStatus providers={providersMock} />);
    // The connected provider should show "Google connected" via role="img" aria-label
    expect(screen.getByLabelText('Google connected')).toBeInTheDocument();
  });

  it('shows status indicators for disconnected provider', () => {
    render(<ConnectedProvidersStatus providers={providersMock} />);
    // The disconnected provider should show "GitHub not connected" via role="img" aria-label
    expect(screen.getByLabelText('GitHub not connected')).toBeInTheDocument();
  });

  it('renders custom className', () => {
    const { container } = render(
      <ConnectedProvidersStatus providers={providersMock} className="custom" />
    );
    expect(container.querySelector('.custom')).toBeInTheDocument();
  });
});
