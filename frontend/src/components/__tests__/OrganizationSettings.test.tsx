import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ThemeProvider } from '../../providers/ThemeProvider';
import { OrganizationSettings } from '../OrganizationSettings';

const mockProcessImageUpload = vi.fn();
vi.mock('../../utils/imageOptimization', () => ({
  processImageUpload: (...args: unknown[]) => mockProcessImageUpload(...args),
}));

function renderSettings() {
  return render(
    <ThemeProvider>
      <OrganizationSettings />
    </ThemeProvider>
  );
}

describe('OrganizationSettings (#062)', () => {
  beforeEach(() => {
    localStorage.clear();
    mockProcessImageUpload.mockReset();
    mockProcessImageUpload.mockResolvedValue('data:image/png;base64,AAAA');
  });

  test('saves branding, contact details and the preferred stablecoin', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.type(screen.getByLabelText('Organization name'), 'Acme Corp');
    await user.type(screen.getByLabelText('Logo URL (https)'), 'https://cdn.acme.com/logo.png');
    await user.type(screen.getByLabelText(/Contact email/), 'ops@acme.com');
    await user.type(screen.getByLabelText(/Contact phone/), '+1 (555) 123-4567');
    await user.selectOptions(screen.getByLabelText('Preferred stablecoin'), 'EURC');
    const primary = screen.getByLabelText('Primary colour');
    await user.clear(primary);
    await user.type(primary, '#123456');
    await user.click(screen.getByRole('button', { name: 'Save settings' }));

    expect(screen.getByRole('status')).toHaveTextContent('Organization settings saved.');
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem('payd-org-brand') ?? '{}')).toMatchObject({
        orgName: 'Acme Corp',
        logoUrl: 'https://cdn.acme.com/logo.png',
        primaryColor: '#123456',
      });
    });
    expect(JSON.parse(localStorage.getItem('payd-org-settings') ?? '{}')).toMatchObject({
      contactEmail: 'ops@acme.com',
      contactPhone: '+1 (555) 123-4567',
      preferredStablecoin: 'EURC',
    });
    expect(localStorage.getItem('preferredStablecoin')).toBe('EURC');
  });

  test('disables saving and reports invalid input', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.type(screen.getByLabelText('Logo URL (https)'), 'javascript:alert(1)');
    await user.type(screen.getByLabelText(/Contact email/), 'not-an-email');
    await user.type(screen.getByLabelText(/Contact phone/), 'abc');

    expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled();
    expect(screen.getByText(/Use an https:\/\/ image URL/)).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid phone number.')).toBeInTheDocument();
  });

  test('cancel restores the saved values without writing storage', async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      'payd-org-settings',
      JSON.stringify({
        contactEmail: 'ops@acme.com',
        contactPhone: '',
        preferredStablecoin: 'EURC',
      })
    );
    localStorage.setItem('payd-org-brand', JSON.stringify({ orgName: 'Acme Corp' }));
    renderSettings();

    const email = screen.getByLabelText(/Contact email/);
    expect(screen.getByLabelText('Organization name')).toHaveValue('Acme Corp');
    expect(email).toHaveValue('ops@acme.com');

    await user.clear(email);
    await user.type(email, 'new@acme.com');
    await user.selectOptions(screen.getByLabelText('Preferred stablecoin'), 'USDC');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(email).toHaveValue('ops@acme.com');
    expect(screen.getByLabelText('Preferred stablecoin')).toHaveValue('EURC');
    expect(screen.getByRole('status')).toHaveTextContent('Changes discarded.');
    expect(localStorage.getItem('payd-org-settings')).toContain('ops@acme.com');
    expect(localStorage.getItem('preferredStablecoin')).toBeNull();
  });

  test('reset clears organization values and storage', async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      'payd-org-settings',
      JSON.stringify({
        contactEmail: 'ops@acme.com',
        contactPhone: '5551234567',
        preferredStablecoin: 'ORGUSD',
      })
    );
    localStorage.setItem('payd-org-brand', JSON.stringify({ orgName: 'Acme Corp' }));
    localStorage.setItem('preferredStablecoin', 'ORGUSD');
    renderSettings();

    await user.click(screen.getByRole('button', { name: 'Reset to defaults' }));

    expect(screen.getByLabelText('Organization name')).toHaveValue('');
    expect(screen.getByLabelText(/Contact email/)).toHaveValue('');
    expect(screen.getByLabelText('Preferred stablecoin')).toHaveValue('USDC');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Organization settings reset to defaults.'
    );
    expect(localStorage.getItem('payd-org-settings')).toBeNull();
    expect(localStorage.getItem('preferredStablecoin')).toBeNull();
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem('payd-org-brand') ?? '{}')).toEqual({});
    });
  });

  test('uploads a logo and previews the sanitized source', async () => {
    const user = userEvent.setup();
    renderSettings();

    const file = new File(['logo'], 'logo.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Upload organization logo file'), file);

    expect(mockProcessImageUpload).toHaveBeenCalledWith(file, { maxWidth: 400, maxHeight: 400 });
    expect(screen.getByLabelText('Logo URL (https)')).toHaveValue('data:image/png;base64,AAAA');
    expect(screen.getByAltText('Organization logo')).toHaveAttribute(
      'src',
      'data:image/png;base64,AAAA'
    );
  });
});
