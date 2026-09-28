import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { OAuthCallbackHandler } from '../OAuthCallbackHandler';

// Mock useSearchParams and useNavigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useSearchParams: () => {
      return [new URLSearchParams(window.location.search)];
    },
  };
});

describe('OAuthCallbackHandler', () => {
  let originalLocation: Location;

  beforeEach(() => {
    originalLocation = window.location;
    delete (window as any).location;
    window.location = { ...originalLocation, search: '' } as Location;
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  it('shows loading state on initial render', () => {
    // Provide a token and a non-resolving promise so the handler stays in the validating/loading view
    window.location.search =
      '?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';

    render(
      <BrowserRouter>
        <OAuthCallbackHandler onTokenReceived={async () => new Promise(() => {})} />
      </BrowserRouter>
    );
    expect(screen.getByText('Verifying your identity')).toBeInTheDocument();
    expect(screen.getByText(/Please wait while we process/)).toBeInTheDocument();
  });

  it('shows validating state during token validation', async () => {
    const onTokenReceived = vi.fn(async () => {
      // Simulate validation delay
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Set token in URL
    window.location.search =
      '?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';

    render(
      <BrowserRouter>
        <OAuthCallbackHandler onTokenReceived={onTokenReceived} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(onTokenReceived).toHaveBeenCalled();
    });
  });

  it('shows success state after token is processed', async () => {
    const onTokenReceived = vi.fn(async () => {});

    window.location.search =
      '?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';

    render(
      <BrowserRouter>
        <OAuthCallbackHandler onTokenReceived={onTokenReceived} />
      </BrowserRouter>
    );

    await waitFor(
      () => {
        expect(screen.getByText('Welcome back!')).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it('shows error state when no token provided', async () => {
    const onError = vi.fn();

    window.location.search = '';

    render(
      <BrowserRouter>
        <OAuthCallbackHandler onTokenReceived={async () => {}} onError={onError} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Authentication failed')).toBeInTheDocument();
      expect(screen.getAllByText(/No authentication token received/).length).toBeGreaterThan(0);
    });
  });

  it('shows error state when error parameter provided', async () => {
    const onError = vi.fn();

    window.location.search = '?error=access_denied';

    render(
      <BrowserRouter>
        <OAuthCallbackHandler onTokenReceived={async () => {}} onError={onError} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Authentication failed')).toBeInTheDocument();
      expect(screen.getAllByText(/You denied access/).length).toBeGreaterThan(0);
    });
  });

  it('shows error state with invalid token format', async () => {
    window.location.search = '?token=invalid-token';

    render(
      <BrowserRouter>
        <OAuthCallbackHandler onTokenReceived={async () => {}} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Authentication failed')).toBeInTheDocument();
    });
  });

  it('calls onTokenReceived with token', async () => {
    const onTokenReceived = vi.fn(async () => {});
    const testToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';

    window.location.search = `?token=${testToken}`;

    render(
      <BrowserRouter>
        <OAuthCallbackHandler onTokenReceived={onTokenReceived} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(onTokenReceived).toHaveBeenCalledWith(testToken);
    });
  });

  it('calls onSuccess when authentication succeeds', async () => {
    const onSuccess = vi.fn();

    window.location.search =
      '?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';

    render(
      <BrowserRouter>
        <OAuthCallbackHandler onTokenReceived={async () => {}} onSuccess={onSuccess} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('calls onError when authentication fails', async () => {
    const onError = vi.fn();

    window.location.search = '?error=server_error';

    render(
      <BrowserRouter>
        <OAuthCallbackHandler onTokenReceived={async () => {}} onError={onError} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(onError).toHaveBeenCalled();
    });
  });

  it('displays retry button on error', async () => {
    window.location.search = '?error=access_denied';

    render(
      <BrowserRouter>
        <OAuthCallbackHandler onTokenReceived={async () => {}} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });
  });

  it('displays back to login button on error', async () => {
    window.location.search = '?error=access_denied';

    render(
      <BrowserRouter>
        <OAuthCallbackHandler onTokenReceived={async () => {}} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Back to Login')).toBeInTheDocument();
    });
  });

  it('has accessible status announcements', async () => {
    window.location.search =
      '?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';

    const { container } = render(
      <BrowserRouter>
        <OAuthCallbackHandler onTokenReceived={async () => {}} />
      </BrowserRouter>
    );

    // Check for status region with aria-live
    const statusRegion = container.querySelector('[role="status"]');
    expect(statusRegion).toBeInTheDocument();
  });

  it('applies custom className', async () => {
    window.location.search = '';

    const { container } = render(
      <BrowserRouter>
        <OAuthCallbackHandler onTokenReceived={async () => {}} className="custom-class" />
      </BrowserRouter>
    );

    const wrapper = container.querySelector('.custom-class');
    expect(wrapper).toBeInTheDocument();
  });
});
