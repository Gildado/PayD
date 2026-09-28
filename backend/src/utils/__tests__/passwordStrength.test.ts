import { validatePasswordStrength, scoreLabel } from '../passwordStrength.js';

// ─── validatePasswordStrength ─────────────────────────────────────────────────

describe('validatePasswordStrength', () => {
  const STRONG = 'Str0ng!Pa$$word';

  it('accepts a password that meets all requirements', () => {
    const result = validatePasswordStrength(STRONG);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.score).toBeGreaterThanOrEqual(3);
  });

  it('rejects an empty string', () => {
    const result = validatePasswordStrength('');
    expect(result.valid).toBe(false);
    expect(result.score).toBe(0);
  });

  it('rejects a password shorter than 12 characters', () => {
    const result = validatePasswordStrength('Short1!Aa');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('12 characters'))).toBe(true);
  });

  it('rejects a password missing an uppercase letter', () => {
    const result = validatePasswordStrength('str0ng!pa$$word');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes('uppercase'))).toBe(true);
  });

  it('rejects a password missing a lowercase letter', () => {
    const result = validatePasswordStrength('STR0NG!PA$$WORD');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes('lowercase'))).toBe(true);
  });

  it('rejects a password missing a digit', () => {
    const result = validatePasswordStrength('Strong!Pa$$word');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('digit'))).toBe(true);
  });

  it('rejects a password missing a special character', () => {
    const result = validatePasswordStrength('Str0ngPassw0rd');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes('special'))).toBe(true);
  });

  it('rejects a password that contains the email prefix (>= 4 chars)', () => {
    const result = validatePasswordStrength('john1234!Pa$$W', 'john@example.com');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('email'))).toBe(true);
  });

  it('ignores a short email prefix (< 4 chars) in the password', () => {
    // Email prefix 'jo' is only 2 chars — too short to trigger the check
    const result = validatePasswordStrength('jo1234!Pa$$Word', 'jo@example.com');
    expect(result.errors.some((e) => e.includes('email'))).toBe(false);
  });

  it('accumulates multiple errors for a very weak password', () => {
    const result = validatePasswordStrength('weak');
    expect(result.errors.length).toBeGreaterThan(1);
    expect(result.score).toBe(0);
  });

  it('assigns a higher score for a longer password', () => {
    const short = validatePasswordStrength('Str0ng!Pa$$w');    // exactly 12 chars
    const long  = validatePasswordStrength('Str0ng!Pa$$wordXXX'); // 18 chars
    expect(long.score).toBeGreaterThan(short.score);
  });

  it('score is capped at 4', () => {
    // Maximally complex password
    const result = validatePasswordStrength('V3ryStr0ng!Pa$$wordExtremely');
    expect(result.score).toBeLessThanOrEqual(4);
  });
});

// ─── scoreLabel ───────────────────────────────────────────────────────────────

describe('scoreLabel', () => {
  it.each([
    [0, 'Very Weak'],
    [1, 'Weak'],
    [2, 'Fair'],
    [3, 'Strong'],
    [4, 'Very Strong'],
  ])('maps score %i to "%s"', (score, label) => {
    expect(scoreLabel(score)).toBe(label);
  });

  it('returns "Unknown" for an out-of-range score', () => {
    expect(scoreLabel(5)).toBe('Unknown');
    expect(scoreLabel(-1)).toBe('Unknown');
  });
});
