import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from '@/lib/utils';

describe('safeRedirectPath', () => {
  it('allows same-origin paths', () => {
    expect(safeRedirectPath('/dashboard')).toBe('/dashboard');
    expect(safeRedirectPath('/strategies/abc?tab=live#x')).toBe('/strategies/abc?tab=live#x');
  });

  it('falls back to "/" for empty / null / non-rooted input', () => {
    expect(safeRedirectPath(undefined)).toBe('/');
    expect(safeRedirectPath(null)).toBe('/');
    expect(safeRedirectPath('')).toBe('/');
    expect(safeRedirectPath('dashboard')).toBe('/');
    expect(safeRedirectPath('https://evil.com')).toBe('/');
  });

  it('blocks protocol-relative and backslash redirects', () => {
    expect(safeRedirectPath('//evil.com')).toBe('/');
    expect(safeRedirectPath('/\\evil.com')).toBe('/');
  });

  it('blocks tab/newline-injection open-redirect bypasses', () => {
    // `?next=/%09/evil.com` decodes to a literal tab; the browser strips it on
    // assign, resolving to `//evil.com`. The guard must neutralise this.
    expect(safeRedirectPath('/\t/evil.com')).toBe('/');
    expect(safeRedirectPath('/\n/evil.com')).toBe('/');
    expect(safeRedirectPath('/\r/evil.com')).toBe('/');
    expect(safeRedirectPath('/\t\\evil.com')).toBe('/');
    // Tab inside an otherwise-valid path is stripped, leaving a safe same-origin path.
    expect(safeRedirectPath('/dash\tboard')).toBe('/dashboard');
  });
});
