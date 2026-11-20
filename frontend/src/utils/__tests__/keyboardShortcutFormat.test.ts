import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatShortcutKey, isMacPlatform } from '../keyboardShortcutFormat';

function mockPlatform(platform: string) {
  vi.stubGlobal('navigator', { ...navigator, platform, userAgent: platform });
}

describe('keyboardShortcutFormat', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('detects a Mac platform', () => {
    mockPlatform('MacIntel');
    expect(isMacPlatform()).toBe(true);
  });

  it('detects a non-Mac platform', () => {
    mockPlatform('Win32');
    expect(isMacPlatform()).toBe(false);
  });

  it('formats a shortcut with the Cmd symbol on Mac', () => {
    mockPlatform('MacIntel');
    expect(formatShortcutKey('k')).toBe('⌘ K');
  });

  it('formats a shortcut with Ctrl on non-Mac platforms', () => {
    mockPlatform('Win32');
    expect(formatShortcutKey('n')).toBe('Ctrl N');
  });

  it('uppercases the key letter', () => {
    mockPlatform('Win32');
    expect(formatShortcutKey('e')).toBe('Ctrl E');
  });
});
