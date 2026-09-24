import { Decimal } from 'decimal.js';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

/** Money helpers — never use JS number for money math. */
export function money(value: string | number | Decimal): Decimal {
  return new Decimal(value);
}

export function moneyToString(value: Decimal, decimalPlaces = 2): string {
  return value.toFixed(decimalPlaces);
}

export function moneyToNumber(value: Decimal, decimalPlaces = 2): number {
  return Number(value.toFixed(decimalPlaces));
}

export function splitInstallmentAmount(
  total: string | number | Decimal,
  parts: number,
): string[] {
  if (parts < 1) {
    throw new Error('installment parts must be >= 1');
  }
  const totalDec = money(total);
  const base = totalDec.div(parts).toDecimalPlaces(2, Decimal.ROUND_FLOOR);
  const amounts: string[] = [];
  let allocated = money(0);
  for (let i = 0; i < parts - 1; i += 1) {
    amounts.push(moneyToString(base));
    allocated = allocated.plus(base);
  }
  amounts.push(moneyToString(totalDec.minus(allocated)));
  return amounts;
}
