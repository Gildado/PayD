export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
}

/** Formats a shortcut letter with the platform-appropriate modifier, e.g. "⌘ K" or "Ctrl K". */
export function formatShortcutKey(key: string): string {
  const modifier = isMacPlatform() ? '⌘' : 'Ctrl';
  return `${modifier} ${key.toUpperCase()}`;
}
