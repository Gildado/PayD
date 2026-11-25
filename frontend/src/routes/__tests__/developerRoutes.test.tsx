import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@stellar/design-system', () => ({
  Icon: { AlertTriangle: () => null },
}));

import { areDeveloperToolsEnabled, getDeveloperRoutes } from '../developerRoutes';

function renderDeveloperRoutes(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        {getDeveloperRoutes().map((route) => (
          <Route key={route.path} path={route.path} element={route.element} />
        ))}
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.stubEnv('DEV', true);
  vi.stubEnv('PUBLIC_ENABLE_DEBUG_TOOLS', undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('developer route gating', () => {
  it('registers no debug routes in production mode', () => {
    vi.stubEnv('DEV', false);
    expect(areDeveloperToolsEnabled()).toBe(false);
    expect(getDeveloperRoutes()).toEqual([]);
  });

  it('registers the debugger and overlay demo routes in dev mode', () => {
    vi.stubEnv('DEV', true);
    expect(areDeveloperToolsEnabled()).toBe(true);
    expect(getDeveloperRoutes().map((route) => route.path)).toEqual([
      '/debug',
      '/debug/:contractName',
      '/debug/transaction-overlay',
    ]);
  });

  it('honours the explicit production feature flag', () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('PUBLIC_ENABLE_DEBUG_TOOLS', 'true');
    expect(areDeveloperToolsEnabled()).toBe(true);
    expect(getDeveloperRoutes()).toHaveLength(3);
  });

  it('does not mount the debugger when routes are disabled', () => {
    vi.stubEnv('DEV', false);
    renderDeveloperRoutes('/debug');
    expect(screen.queryByText('v21')).not.toBeInTheDocument();
    expect(screen.queryByText('Transaction Overlay Demo')).not.toBeInTheDocument();
  });

  it('mounts the debugger when enabled', async () => {
    vi.stubEnv('DEV', true);
    renderDeveloperRoutes('/debug');
    expect(await screen.findByText('v21', {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('keeps the debugger modules out of the eagerly imported App module', () => {
    const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
    expect(appSource).not.toMatch(/from\s+['"]\.\/pages\/Debugger['"]/);
    expect(appSource).not.toContain('TransactionOverlayDemo');
    expect(appSource).toContain('getDeveloperRoutes');
  });

  it('keeps both dynamic imports inside the guarded branch', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/routes/developerRoutes.tsx'), 'utf8');
    const guardedBranch = source.slice(source.indexOf('if (!enabled)'));
    expect(guardedBranch).toContain("import('../pages/Debugger')");
    expect(guardedBranch).toContain("import('../components/TransactionOverlayDemo')");
  });
});
