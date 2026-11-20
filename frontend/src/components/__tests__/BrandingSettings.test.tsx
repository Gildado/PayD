import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test } from 'vitest';
import { ThemeProvider } from '../../providers/ThemeProvider';
import { BrandingSettings } from '../BrandingSettings';
import { BrandLogo } from '../BrandLogo';

function renderAll() {
  return render(
    <ThemeProvider>
      <BrandLogo />
      <BrandingSettings />
    </ThemeProvider>
  );
}

describe('BrandingSettings (#1505)', () => {
  beforeEach(() => localStorage.removeItem('payd-org-brand'));

  test('saves org name, logo and colours and themes the header', async () => {
    const user = userEvent.setup();
    renderAll();

    await user.type(screen.getByLabelText('Organization name'), 'Acme Corp');
    await user.type(screen.getByLabelText('Logo URL (https)'), 'https://cdn.acme.com/logo.png');
    const primary = screen.getByLabelText('Primary colour');
    await user.clear(primary);
    await user.type(primary, '#123456');
    await user.click(screen.getByRole('button', { name: 'Save branding' }));

    expect(screen.getByRole('status')).toHaveTextContent('Branding saved.');
    expect(screen.getByAltText('Acme Corp logo')).toHaveAttribute('src', 'https://cdn.acme.com/logo.png');
    expect(document.documentElement.style.getPropertyValue('--brand-primary')).toBe('#123456');
    expect(JSON.parse(localStorage.getItem('payd-org-brand') ?? '{}')).toMatchObject({
      orgName: 'Acme Corp',
      primaryColor: '#123456',
    });
  });

  test('blocks save and explains invalid input', async () => {
    const user = userEvent.setup();
    renderAll();

    await user.type(screen.getByLabelText('Logo URL (https)'), 'javascript:alert(1)');
    expect(screen.getByText(/Use an https:\/\/ image URL/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save branding' })).toBeDisabled();
  });

  test('reset restores the default PayD wordmark', async () => {
    const user = userEvent.setup();
    localStorage.setItem('payd-org-brand', JSON.stringify({ orgName: 'Acme Corp' }));
    renderAll();
    expect(screen.getAllByText('Acme Corp').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Reset to PayD default' }));
    expect(screen.queryByText('Acme Corp')).toBeNull();
    expect(screen.getByText('Pay')).toBeInTheDocument();
  });
});
