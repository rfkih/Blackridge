import { describe, it, expect } from 'vitest';
import {
  ACCOUNT_TYPES,
  DEFAULT_ACCOUNT_TYPE,
  isAccountType,
  type AccountType,
} from './accountType';

describe('accountType', () => {
  it('exposes exactly the two account types', () => {
    expect(ACCOUNT_TYPES).toHaveLength(2);
    expect(ACCOUNT_TYPES).toEqual(['TRADING', 'HEDGING']);
  });

  it('defaults to TRADING', () => {
    expect(DEFAULT_ACCOUNT_TYPE).toBe('TRADING');
  });

  describe('isAccountType', () => {
    it('returns true for the valid account types', () => {
      expect(isAccountType('TRADING')).toBe(true);
      expect(isAccountType('HEDGING')).toBe(true);
    });

    it('returns false for anything else', () => {
      expect(isAccountType('trading')).toBe(false);
      expect(isAccountType('FOO')).toBe(false);
      expect(isAccountType('')).toBe(false);
      expect(isAccountType(null)).toBe(false);
      expect(isAccountType(undefined)).toBe(false);
      expect(isAccountType(0)).toBe(false);
      expect(isAccountType({})).toBe(false);
    });

    it('narrows the type for downstream use', () => {
      const v: unknown = 'HEDGING';
      if (isAccountType(v)) {
        const narrowed: AccountType = v;
        expect(narrowed).toBe('HEDGING');
      }
    });
  });
});
