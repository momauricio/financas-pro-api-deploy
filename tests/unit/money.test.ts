import { describe, expect, it } from 'vitest';
import { money, moneyToString, splitInstallmentAmount } from '../../src/shared/utils/money.js';

describe('money utils', () => {
  it('splits installments without losing cents', () => {
    const parts = splitInstallmentAmount('100.00', 3);
    expect(parts).toEqual(['33.33', '33.33', '33.34']);
    const sum = parts.reduce((acc, p) => acc.plus(money(p)), money(0));
    expect(moneyToString(sum)).toBe('100.00');
  });
});
