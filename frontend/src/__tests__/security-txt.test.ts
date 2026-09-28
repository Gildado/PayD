import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SECURITY_TXT_PATH = resolve(__dirname, '../../public/.well-known/security.txt');

describe('security.txt (RFC 9116)', () => {
  it('exists at the correct path', () => {
    expect(existsSync(SECURITY_TXT_PATH)).toBe(true);
  });

  it('contains a Contact field', () => {
    const content = readFileSync(SECURITY_TXT_PATH, 'utf-8');
    expect(content).toMatch(/^Contact:/m);
  });

  it('contains an Expires field', () => {
    const content = readFileSync(SECURITY_TXT_PATH, 'utf-8');
    expect(content).toMatch(/^Expires:/m);
  });

  it('Expires field is in the future', () => {
    const content = readFileSync(SECURITY_TXT_PATH, 'utf-8');
    const match = content.match(/^Expires:\s*(.+)$/m);
    expect(match).not.toBeNull();
    const expiresDate = new Date(match![1].trim());
    expect(expiresDate.getTime()).toBeGreaterThan(Date.now());
  });

  it('contains a Policy field', () => {
    const content = readFileSync(SECURITY_TXT_PATH, 'utf-8');
    expect(content).toMatch(/^Policy:/m);
  });

  it('contains a Canonical field', () => {
    const content = readFileSync(SECURITY_TXT_PATH, 'utf-8');
    expect(content).toMatch(/^Canonical:/m);
  });

  it('contains a Preferred-Languages field', () => {
    const content = readFileSync(SECURITY_TXT_PATH, 'utf-8');
    expect(content).toMatch(/^Preferred-Languages:/m);
  });

  it('does not contain any empty field values', () => {
    const content = readFileSync(SECURITY_TXT_PATH, 'utf-8');
    const lines = content.split('\n').filter((l: string) => l.trim() && !l.startsWith('#'));
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      const value = line.slice(colonIndex + 1).trim();
      expect(value.length).toBeGreaterThan(0);
    }
  });
});
