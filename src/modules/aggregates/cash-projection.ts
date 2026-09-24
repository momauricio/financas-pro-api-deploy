/**
 * Unified cash projection — single source of truth for SummaryCards + Forecast.
 *
 * ## Invoice lag (critical)
 *
 * **Canonical rule:** in calendar month `M`, cash pays the credit invoice whose
 * `invoiceMonthId === prevMonth(M)` (lag = 1).
 *
 * This matches the dashboard SummaryCards ("Fatura anterior" / saldo atual).
 * ForecastPlanningSection previously attributed invoice cash to the *same*
 * month as `invoiceMonthId` (lag = 0) — that divergence is closed here.
 *
 * Competence / spending ceilings still use `invoiceMonthId` directly via
 * `expenseMonthId` (no lag) — only **cash outflow** uses the lag.
 */

import { money, moneyToNumber } from '../../shared/utils/money.js';
import { daysInMonth, prevMonthId, toMonthId } from '../../shared/utils/dates.js';
import {
  OPENING_BALANCE_CATEGORY,
  isInvestmentCategory,
  type TxLike,
} from './expense-aggregates.js';

/** Months between invoice competence and cash payment. Do not change lightly. */
export const CASH_INVOICE_LAG_MONTHS = 1 as const;

export type GoalLike = {
  monthId: string;
  category: string;
  amount: number;
};

export type CashTx = TxLike & {
  paymentMethod?: string | null;
  isPaid?: boolean | null;
};

export type MonthlyCashFlow = {
  monthId: string;
  income: number;
  cashExpenses: number;
  /** Credit invoice amount paid in cash this calendar month (lagged). */
  invoiceDue: number;
  /** invoiceMonthId that was paid (prev month when lag=1). */
  invoiceCompetenceMonthId: string;
  net: number;
};

export type CashCheckpoint = {
  checkpointMonthId: string;
  checkpointBalance: number;
};

export type SummaryMetrics = {
  monthId: string;
  caixaAcumulado: number;
  entradas: number;
  gastosVistaDisplay: number;
  investimentos: number;
  faturaPagarAgora: number;
  /** invoiceMonthId of faturaPagarAgora */
  faturaCompetenceMonthId: string;
  totalSaidas: number;
  saldoAtual: number;
  cashInvoiceLagMonths: typeof CASH_INVOICE_LAG_MONTHS;
};

export type ForecastMetrics = {
  monthId: string;
  currentCashBalance: number;
  projected30: number;
  projected60: number;
  projected90: number;
  averageNet: number;
  averageIncome: number;
  averageCashExpense: number;
  averageInvoice: number;
  currentMonthIncome: number;
  currentMonthCashExpenses: number;
  currentMonthInvoice: number;
  faturaCompetenceMonthId: string;
  fixedCommitments: number;
  budgetAfterCommitments: number;
  reserveTarget: number;
  cashInvoiceLagMonths: typeof CASH_INVOICE_LAG_MONTHS;
  monthlyFlows: MonthlyCashFlow[];
};

/** Which invoice competence month is paid in cash during `calendarMonthId`. */
export function cashInvoiceCompetenceMonthId(calendarMonthId: string): string {
  if (CASH_INVOICE_LAG_MONTHS === 1) {
    return prevMonthId(calendarMonthId);
  }
  // Future: support 0 for same-month due-day models.
  return calendarMonthId;
}

function isCredit(t: CashTx): boolean {
  return t.paymentMethod === 'Crédito';
}

function paidIncome(transactions: CashTx[], monthId: string) {
  return transactions
    .filter(
      (t) =>
        t.type === 'income' &&
        t.isPaid &&
        t.date.substring(0, 7) === monthId,
    )
    .reduce((s, t) => s.plus(money(t.amount)), money(0));
}

function paidCashExpenses(transactions: CashTx[], monthId: string) {
  return transactions
    .filter(
      (t) =>
        t.type === 'expense' &&
        !isCredit(t) &&
        t.isPaid &&
        t.date.substring(0, 7) === monthId,
    )
    .reduce((s, t) => s.plus(money(t.amount)), money(0));
}

/** Sum of credit expenses whose invoiceMonthId equals competence. */
export function invoiceTotalForCompetence(
  transactions: CashTx[],
  competenceMonthId: string,
) {
  return transactions
    .filter(
      (t) =>
        t.type === 'expense' &&
        isCredit(t) &&
        (t.invoiceMonthId || t.date.substring(0, 7)) === competenceMonthId,
    )
    .reduce((s, t) => s.plus(money(t.amount)), money(0));
}

export function resolveCashCheckpoint(
  goals: GoalLike[],
  initialBalance: number,
  currentMonthId: string,
): CashCheckpoint {
  const sorted = [...goals]
    .filter((g) => g.category === OPENING_BALANCE_CATEGORY)
    .sort((a, b) => a.monthId.localeCompare(b.monthId));

  let checkpointMonthId = '';
  let checkpointBalance = initialBalance;

  for (const g of sorted) {
    if (g.monthId > currentMonthId) break;
    checkpointMonthId = g.monthId;
    checkpointBalance = g.amount;
  }

  return { checkpointMonthId, checkpointBalance };
}

export function buildMonthlyCashFlows(
  transactions: CashTx[],
  monthIds: string[],
): MonthlyCashFlow[] {
  return monthIds.map((monthId) => {
    const income = paidIncome(transactions, monthId);
    const cashExpenses = paidCashExpenses(transactions, monthId);
    const invoiceCompetenceMonthId = cashInvoiceCompetenceMonthId(monthId);
    const invoiceDue = invoiceTotalForCompetence(
      transactions,
      invoiceCompetenceMonthId,
    );
    const net = income.minus(cashExpenses).minus(invoiceDue);
    return {
      monthId,
      income: moneyToNumber(income),
      cashExpenses: moneyToNumber(cashExpenses),
      invoiceDue: moneyToNumber(invoiceDue),
      invoiceCompetenceMonthId,
      net: moneyToNumber(net),
    };
  });
}

/**
 * Opening cash (caixa acumulado) before applying current-month movements —
 * same basis as SummaryCards "Caixa anterior".
 */
export function computeCaixaAcumulado(
  transactions: CashTx[],
  goals: GoalLike[],
  initialBalance: number,
  currentMonthId: string,
  knownMonthIds: string[],
): number {
  const { checkpointMonthId, checkpointBalance } = resolveCashCheckpoint(
    goals,
    initialBalance,
    currentMonthId,
  );

  const sorted = [...knownMonthIds].sort();
  const flows = buildMonthlyCashFlows(
    transactions,
    sorted.filter((m) => m <= currentMonthId),
  );

  let caixa = money(checkpointBalance);
  for (const flow of flows) {
    const inRange = checkpointMonthId
      ? flow.monthId >= checkpointMonthId && flow.monthId < currentMonthId
      : flow.monthId < currentMonthId;
    if (inRange) {
      caixa = caixa.plus(money(flow.net));
    }
  }
  return moneyToNumber(caixa);
}

export function computeSummaryMetrics(input: {
  transactions: CashTx[];
  goals: GoalLike[];
  initialBalance: number;
  currentMonthId: string;
  knownMonthIds: string[];
}): SummaryMetrics {
  const { transactions, goals, initialBalance, currentMonthId, knownMonthIds } =
    input;

  const caixaAcumulado = computeCaixaAcumulado(
    transactions,
    goals,
    initialBalance,
    currentMonthId,
    knownMonthIds,
  );

  const currentTxs = transactions.filter(
    (t) => t.date.substring(0, 7) === currentMonthId,
  );

  const entradas = moneyToNumber(paidIncome(transactions, currentMonthId));

  const investimentos = moneyToNumber(
    currentTxs
      .filter(
        (t) =>
          t.type === 'expense' &&
          isInvestmentCategory(t.category) &&
          !!t.isPaid,
      )
      .reduce((s, t) => s.plus(money(t.amount)), money(0)),
  );

  const gastosVistaRaw = moneyToNumber(
    paidCashExpenses(transactions, currentMonthId),
  );

  const investimentosVista = moneyToNumber(
    currentTxs
      .filter(
        (t) =>
          t.type === 'expense' &&
          !isCredit(t) &&
          isInvestmentCategory(t.category) &&
          !!t.isPaid,
      )
      .reduce((s, t) => s.plus(money(t.amount)), money(0)),
  );

  const gastosVistaDisplay = Math.max(0, gastosVistaRaw - investimentosVista);

  const faturaCompetenceMonthId =
    cashInvoiceCompetenceMonthId(currentMonthId);
  const faturaPagarAgora = moneyToNumber(
    invoiceTotalForCompetence(transactions, faturaCompetenceMonthId),
  );

  const totalSaidas =
    Math.round((gastosVistaDisplay + faturaPagarAgora) * 100) / 100;
  const saldoAtual = moneyToNumber(
    money(caixaAcumulado)
      .plus(entradas)
      .minus(gastosVistaRaw)
      .minus(faturaPagarAgora),
  );

  return {
    monthId: currentMonthId,
    caixaAcumulado,
    entradas,
    gastosVistaDisplay,
    investimentos,
    faturaPagarAgora,
    faturaCompetenceMonthId,
    totalSaidas,
    saldoAtual,
    cashInvoiceLagMonths: CASH_INVOICE_LAG_MONTHS,
  };
}

export function computeForecastMetrics(input: {
  transactions: CashTx[];
  goals: GoalLike[];
  initialBalance: number;
  currentMonthId: string;
  knownMonthIds: string[];
  asOf?: Date;
}): ForecastMetrics {
  const {
    transactions,
    goals,
    initialBalance,
    currentMonthId,
    knownMonthIds,
    asOf = new Date(),
  } = input;

  const sorted = [...knownMonthIds].sort().filter((m) => m <= currentMonthId);
  const monthlyFlows = buildMonthlyCashFlows(transactions, sorted);

  const { checkpointMonthId, checkpointBalance } = resolveCashCheckpoint(
    goals,
    initialBalance,
    currentMonthId,
  );

  let balanceBefore = money(checkpointBalance);
  for (const flow of monthlyFlows) {
    const inRange = checkpointMonthId
      ? flow.monthId >= checkpointMonthId && flow.monthId < currentMonthId
      : flow.monthId < currentMonthId;
    if (inRange) {
      balanceBefore = balanceBefore.plus(money(flow.net));
    }
  }

  const currentMonthIncome = paidIncome(transactions, currentMonthId);
  const currentMonthCashExpenses = paidCashExpenses(
    transactions,
    currentMonthId,
  );
  const faturaCompetenceMonthId =
    cashInvoiceCompetenceMonthId(currentMonthId);
  const currentMonthInvoice = invoiceTotalForCompetence(
    transactions,
    faturaCompetenceMonthId,
  );

  const currentCashBalance = balanceBefore
    .plus(currentMonthIncome)
    .minus(currentMonthCashExpenses)
    .minus(currentMonthInvoice);

  const recentFlows = monthlyFlows.slice(-6);
  const avg = (pick: (f: MonthlyCashFlow) => number) =>
    recentFlows.length === 0
      ? money(0)
      : recentFlows
          .reduce((s, f) => s.plus(money(pick(f))), money(0))
          .div(recentFlows.length);

  const averageNet = avg((f) => f.net);
  const averageIncome = avg((f) => f.income);
  const averageCashExpense = avg((f) => f.cashExpenses);
  const averageInvoice = avg((f) => f.invoiceDue);

  const projected30 = currentCashBalance.plus(averageNet);
  const projected60 = currentCashBalance.plus(averageNet.times(2));
  const projected90 = currentCashBalance.plus(averageNet.times(3));

  const currentTxs = transactions.filter(
    (t) => t.date.substring(0, 7) === currentMonthId,
  );
  const fixedCommitments = moneyToNumber(
    currentTxs
      .filter((t) => t.type === 'expense' && t.isFixed && t.isPaid)
      .reduce((s, t) => s.plus(money(t.amount)), money(0)),
  );

  const budgetAfterCommitments = moneyToNumber(
    DecimalMaxZero(
      currentCashBalance
        .plus(averageNet)
        .minus(fixedCommitments)
        .minus(currentMonthInvoice),
    ),
  );

  const reserveTarget = moneyToNumber(
    DecimalMax(
      averageIncome.times(0.1),
      averageCashExpense.times(0.25),
    ),
  );

  // Touch asOf / daysInMonth so pace helpers stay available for alerts layer.
  void daysInMonth(currentMonthId);
  void toMonthId(asOf);

  return {
    monthId: currentMonthId,
    currentCashBalance: moneyToNumber(currentCashBalance),
    projected30: moneyToNumber(projected30),
    projected60: moneyToNumber(projected60),
    projected90: moneyToNumber(projected90),
    averageNet: moneyToNumber(averageNet),
    averageIncome: moneyToNumber(averageIncome),
    averageCashExpense: moneyToNumber(averageCashExpense),
    averageInvoice: moneyToNumber(averageInvoice),
    currentMonthIncome: moneyToNumber(currentMonthIncome),
    currentMonthCashExpenses: moneyToNumber(currentMonthCashExpenses),
    currentMonthInvoice: moneyToNumber(currentMonthInvoice),
    faturaCompetenceMonthId,
    fixedCommitments,
    budgetAfterCommitments,
    reserveTarget,
    cashInvoiceLagMonths: CASH_INVOICE_LAG_MONTHS,
    monthlyFlows,
  };
}

function DecimalMaxZero(v: ReturnType<typeof money>) {
  return v.isNeg() ? money(0) : v;
}

function DecimalMax(a: ReturnType<typeof money>, b: ReturnType<typeof money>) {
  return a.gte(b) ? a : b;
}

/** Assert SummaryCards saldoAtual === Forecast currentCashBalance (unified). */
export function assertCashParity(
  summary: SummaryMetrics,
  forecast: ForecastMetrics,
): boolean {
  return (
    summary.saldoAtual === forecast.currentCashBalance &&
    summary.faturaPagarAgora === forecast.currentMonthInvoice &&
    summary.faturaCompetenceMonthId === forecast.faturaCompetenceMonthId &&
    summary.cashInvoiceLagMonths === forecast.cashInvoiceLagMonths
  );
}
