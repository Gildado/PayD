import { Suspense, lazy } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import ErrorBoundary from '../components/ErrorBoundary';
import ErrorFallback from '../components/ErrorFallback';

export interface DeveloperRoute {
  path: string;
  element: ReactElement;
}

/**
 * Developer-only tooling is compiled into a separate chunk and only mounted
 * in development (or when PUBLIC_ENABLE_DEBUG_TOOLS=true).
 *
 * `import.meta.env.DEV` is replaced with a boolean literal by Vite, so in a
 * production build the guarded branch — including both `import()` calls — is
 * statically removed and the debugger modules are tree-shaken away.
 */
export function areDeveloperToolsEnabled(): boolean {
  return import.meta.env.DEV === true || import.meta.env.PUBLIC_ENABLE_DEBUG_TOOLS === 'true';
}

function DebugRouteBoundary({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <ErrorBoundary
      fallback={
        <ErrorFallback
          title={t('errorFallback.debuggerTitle')}
          description={t('errorFallback.debuggerDescription')}
        />
      }
    >
      <Suspense fallback={null}>{children}</Suspense>
    </ErrorBoundary>
  );
}

let cachedRoutes: DeveloperRoute[] | null = null;
let cachedEnabled: boolean | null = null;

/** Returns the developer-only route table (empty in production). */
export function getDeveloperRoutes(): DeveloperRoute[] {
  const enabled = areDeveloperToolsEnabled();
  if (cachedRoutes && cachedEnabled === enabled) return cachedRoutes;

  if (!enabled) {
    cachedRoutes = [];
    cachedEnabled = enabled;
    return cachedRoutes;
  }

  // These dynamic imports deliberately live *inside* the guarded branch so
  // production builds never emit chunks for the developer tools.
  const Debugger = lazy(() => import('../pages/Debugger'));
  const TransactionOverlayDemo = lazy(() =>
    import('../components/TransactionOverlayDemo').then((module) => ({
      default: module.TransactionOverlayDemo,
    }))
  );

  const guarded = (node: ReactElement): ReactElement => (
    <DebugRouteBoundary>{node}</DebugRouteBoundary>
  );

  cachedRoutes = [
    { path: '/debug', element: guarded(<Debugger />) },
    { path: '/debug/:contractName', element: guarded(<Debugger />) },
    { path: '/debug/transaction-overlay', element: guarded(<TransactionOverlayDemo />) },
  ];
  cachedEnabled = enabled;
  return cachedRoutes;
}
