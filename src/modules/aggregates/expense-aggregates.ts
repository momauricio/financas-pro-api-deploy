/**
 * Expense / competence helpers — parity with front `lib/expenseAggregates`.
 * Money sums use Decimal at the call sites (cash-projection / service).
 */

export function isInvestmentCategory(category: string): boolean {
  const n = category.toLowerCase();
  return n.includes('investimento') || n.includes('invest');
}

export const OPENING_BALANCE_CATEGORY = '__SALDO_INICIAL__';

export function isSpendingGoalCategory(category: string): boolean {
  return (
    Boolean(category) &&
    category !== OPENING_BALANCE_CATEGORY &&
    !isInvestmentCategory(category)
  );
}

export type TxLike = {
  id?: string;
  type: string;
  category: string;
  amount: number;
  invoiceMonthId?: string | null;
  date: string;
  paymentMethod?: string | null;
  isPaid?: boolean | null;
  isFixed?: boolean | null;
  cardId?: string | null;
  recurringGroupId?: string | null;
  installments?: { current: number; total: number } | null;
};

export function withoutInvestments<T extends TxLike>(transactions: T[]): T[] {
  return transactions.filter((t) => !isInvestmentCategory(t.category));
}

export function onlyInvestments<T extends TxLike>(transactions: T[]): T[] {
  return transactions.filter(
    (t) => t.type === 'expense' && isInvestmentCategory(t.category),
  );
}

export function sumInvestmentContributions(transactions: TxLike[]): number {
  return onlyInvestments(transactions).reduce((s, t) => s + t.amount, 0);
}

/** Competence month for spending (invoice / cash). */
export function expenseMonthId(t: TxLike): string {
  return t.invoiceMonthId || t.date.substring(0, 7);
}

export type GoalsPeriodFilter =
  | 'last60d'
  | 'last90d'
  | 'last6'
  | 'last9'
  | 'last12'
  | 'lastYear';

const DAY_PERIOD_DAYS: Partial<Record<GoalsPeriodFilter, number>> = {
  last60d: 60,
  last90d: 90,
};

export function isDayBasedPeriod(filter: GoalsPeriodFilter): boolean {
  return filter === 'last60d' || filter === 'last90d';
}

export function periodDayCount(filter: GoalsPeriodFilter): number | null {
  return DAY_PERIOD_DAYS[filter] ?? null;
}

export function resolvePeriodMonthIds(
  currentMonthId: string,
  filter: GoalsPeriodFilter,
): string[] {
  if (isDayBasedPeriod(filter)) return [];

  if (filter === 'lastYear') {
    const year = parseInt(currentMonthId.split('-')[0], 10) - 1;
    return Array.from(
      { length: 12 },
      (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`,
    );
  }

  const count = filter === 'last6' ? 6 : filter === 'last9' ? 9 : 12;
  const ids: string[] = [];
  const [year, month] = currentMonthId.split('-').map(Number);
  for (let i = count; i >= 1; i -= 1) {
    const d = new Date(year, month - 1 - i, 1);
    ids.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    );
  }
  return ids;
}

/**
 * Despesas do mês de competência, contando cada compra parcelada uma vez
 * (dedupe por recurringGroupId).
 */
export function expensesForMonth(
  transactions: TxLike[],
  monthId: string,
): TxLike[] {
  const inMonth = transactions.filter(
    (t) => t.type === 'expense' && expenseMonthId(t) === monthId,
  );
  const seenGroups = new Set<string>();
  const unique: TxLike[] = [];

  inMonth.forEach((t) => {
    if (t.recurringGroupId) {
      if (seenGroups.has(t.recurringGroupId)) return;
      seenGroups.add(t.recurringGroupId);
    }
    unique.push(t);
  });

  return unique;
}

export function sumByCategory(expenses: TxLike[]): Record<string, number> {
  const acc: Record<string, number> = {};
  expenses.forEach((t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
  });
  return acc;
}

export function monthSpendTotal(
  transactions: TxLike[],
  monthId: string,
): number {
  const byCat = sumByCategory(expensesForMonth(transactions, monthId));
  const total = Object.values(byCat).reduce((s, v) => s + Math.max(0, v), 0);
  return Math.round(total * 100) / 100;
}

export function monthlyAverageByCategory(
  transactions: TxLike[],
  monthIds: string[],
): Record<string, number> {
  const denominator = Math.max(1, monthIds.length);
  const totals: Record<string, number> = {};

  monthIds.forEach((monthId) => {
    const byCat = sumByCategory(expensesForMonth(transactions, monthId));
    Object.entries(byCat).forEach(([category, amount]) => {
      totals[category] = (totals[category] || 0) + amount;
    });
  });

  const averages: Record<string, number> = {};
  Object.entries(totals).forEach(([category, total]) => {
    averages[category] = Math.round((total / denominator) * 100) / 100;
  });
  return averages;
}

export function expensesInLastDays(
  transactions: TxLike[],
  days: number,
  asOf: Date = new Date(),
): TxLike[] {
  const end = new Date(asOf);
  end.setHours(23, 59, 59, 999);
  const start = new Date(asOf);
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);

  const monthIds: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= last) {
    monthIds.push(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`,
    );
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const seen = new Set<string>();
  const unique: TxLike[] = [];
  monthIds.forEach((monthId) => {
    expensesForMonth(transactions, monthId).forEach((t) => {
      const key = t.recurringGroupId
        ? `${t.recurringGroupId}|${expenseMonthId(t)}`
        : t.id || `${t.date}|${t.category}|${t.amount}`;
      if (seen.has(key)) return;
      seen.add(key);
      unique.push(t);
    });
  });

  return unique;
}

export function monthlyAverageFromDays(
  transactions: TxLike[],
  days: number,
): Record<string, number> {
  const totals = sumByCategory(expensesInLastDays(transactions, days));
  const factor = 30 / Math.max(1, days);
  const averages: Record<string, number> = {};
  Object.entries(totals).forEach(([category, total]) => {
    averages[category] = Math.round(total * factor * 100) / 100;
  });
  return averages;
}

export function baselineAverages(
  transactions: TxLike[],
  currentMonthId: string,
  filter: GoalsPeriodFilter,
): { averages: Record<string, number>; denominatorLabel: string } {
  if (isDayBasedPeriod(filter)) {
    const days = periodDayCount(filter)!;
    return {
      averages: monthlyAverageFromDays(transactions, days),
      denominatorLabel: `${days} dias por competência → média mensal (× 30/${days})`,
    };
  }

  const monthIds = resolvePeriodMonthIds(currentMonthId, filter);
  return {
    averages: monthlyAverageByCategory(transactions, monthIds),
    denominatorLabel: `${monthIds.length} meses no denominador`,
  };
}

export function sumGoalsTotal(
  goals: { category?: string; amount: number }[] | undefined,
): number {
  const list = (goals || []).filter((g) =>
    isSpendingGoalCategory(g.category || ''),
  );
  return list.reduce((s, g) => s + (g.amount || 0), 0);
}

/**
 * Reparte totalBudget nas categorias pela proporção das médias.
 * O último item com peso > 0 absorve centavos para fechar o total.
 */
export function allocateBudgetByWeights(
  totalBudget: number,
  categories: { category: string; average: number }[],
): { category: string; amount: number }[] {
  if (!(totalBudget > 0) || categories.length === 0) return [];

  const withWeight = categories.map((c) => ({
    category: c.category,
    average: Math.max(0, c.average || 0),
  }));
  const weightSum = withWeight.reduce((s, c) => s + c.average, 0);
  if (!(weightSum > 0)) return [];

  const weighted = withWeight.filter((c) => c.average > 0);
  const amounts: { category: string; amount: number }[] = [];
  let allocated = 0;

  weighted.forEach((c, index) => {
    if (index === weighted.length - 1) {
      const rest = Math.round((totalBudget - allocated) * 100) / 100;
      amounts.push({ category: c.category, amount: Math.max(0, rest) });
      return;
    }
    const amount =
      Math.round(((totalBudget * c.average) / weightSum) * 100) / 100;
    allocated += amount;
    amounts.push({ category: c.category, amount });
  });

  return amounts;
}
