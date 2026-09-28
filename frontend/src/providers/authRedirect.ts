import { LocalStorageHelper } from '../utils/localStorage';

export const POST_AUTH_REDIRECT_KEY = 'payd_post_auth_redirect';

const postAuthRedirectStorage = new LocalStorageHelper<string>(POST_AUTH_REDIRECT_KEY, {
  version: 1,
  migrate: (raw) => (typeof raw === 'string' ? raw : '/'),
});

export function normalizePostAuthRedirect(pathname?: string | null): string | null {
  if (!pathname) return null;

  const normalized = pathname.trim();

  if (!normalized.startsWith('/')) return null;
  if (normalized.startsWith('//')) return null;

  return normalized;
}

export function storePostAuthRedirect(pathname?: string | null): void {
  const normalized = normalizePostAuthRedirect(pathname);

  if (!normalized) {
    postAuthRedirectStorage.remove();
    return;
  }

  postAuthRedirectStorage.set(normalized);
}

export function readPostAuthRedirect(): string | null {
  return normalizePostAuthRedirect(postAuthRedirectStorage.get());
}

export function clearPostAuthRedirect(): void {
  postAuthRedirectStorage.remove();
}

export function consumePostAuthRedirect(): string | null {
  const redirect = readPostAuthRedirect();
  clearPostAuthRedirect();
  return redirect;
}
