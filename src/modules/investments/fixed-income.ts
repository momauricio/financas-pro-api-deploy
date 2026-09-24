import { money } from '../../shared/utils/money.js';

export type FixedIncomeIndex = 'cdi' | 'selic' | 'ipca' | 'pre';

export type MonthIndexRates = {
  monthId: string;
  /** Monthly variation as decimal (e.g. 0.009 = 0.9%). */
  cdi: number | null;
  selic: number | null;
  ipca: number | null;
};

/** Factor to apply: next = prev * (1 + factor). */
export function monthFactor(
  index: FixedIncomeIndex,
  ratePct: number,
  rates: MonthIndexRates,
): number | null {
  if (!(ratePct > 0)) return null;
  if (index === 'pre') {
    return money(ratePct).div(100).div(12).toNumber();
  }
  const base =
    index === 'cdi' ? rates.cdi : index === 'selic' ? rates.selic : rates.ipca;
  if (base == null || !Number.isFinite(base)) return null;
  return money(base).mul(money(ratePct).div(100)).toNumber();
}

export function isInvestmentCategory(category: string): boolean {
  const n = category.toLowerCase();
  return n.includes('investimento') || n.includes('invest');
}
