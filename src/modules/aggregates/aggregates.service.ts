import { ValidationError } from '../../shared/errors/index.js';
import { toMonthId } from '../../shared/utils/dates.js';
import {
  assertCashParity,
  computeForecastMetrics,
  computeSummaryMetrics,
  CASH_INVOICE_LAG_MONTHS,
} from './cash-projection.js';
import {
  baselineAverages,
  isInvestmentCategory,
  onlyInvestments,
  sumInvestmentContributions,
  withoutInvestments,
  type GoalsPeriodFilter,
} from './expense-aggregates.js';
import {
  buildFinancialAlerts,
  countActionableFinancialAlerts,
} from './financial-alerts.js';
import { AggregatesRepository } from './aggregates.repository.js';

function resolveMonthId(monthId?: string): string {
  if (!monthId) return toMonthId(new Date());
  if (!/^\d{4}-\d{2}$/.test(monthId)) {
    throw new ValidationError('monthId must be YYYY-MM');
  }
  return monthId;
}

export class AggregatesService {
  constructor(
    private readonly repo: AggregatesRepository = new AggregatesRepository(),
  ) {}

  async getSummary(userId: string, monthId?: string) {
    const mid = resolveMonthId(monthId);
    const snap = await this.repo.loadForUser(userId);
    return computeSummaryMetrics({
      transactions: snap.transactions,
      goals: snap.goals,
      initialBalance: snap.initialBalance,
      currentMonthId: mid,
      knownMonthIds: snap.knownMonthIds,
    });
  }

  async getForecast(userId: string, monthId?: string) {
    const mid = resolveMonthId(monthId);
    const snap = await this.repo.loadForUser(userId);
    const forecast = computeForecastMetrics({
      transactions: snap.transactions,
      goals: snap.goals,
      initialBalance: snap.initialBalance,
      currentMonthId: mid,
      knownMonthIds: snap.knownMonthIds,
    });
    const summary = computeSummaryMetrics({
      transactions: snap.transactions,
      goals: snap.goals,
      initialBalance: snap.initialBalance,
      currentMonthId: mid,
      knownMonthIds: snap.knownMonthIds,
    });
    return {
      ...forecast,
      /** Always true when both use CASH_INVOICE_LAG_MONTHS — guarded in tests. */
      unifiedWithSummary: assertCashParity(summary, forecast),
      summarySaldoAtual: summary.saldoAtual,
    };
  }

  async getFinancialAlerts(userId: string, monthId?: string) {
    const mid = resolveMonthId(monthId);
    const snap = await this.repo.loadForUser(userId);
    const monthGoals = snap.goals.filter((g) => g.monthId === mid);
    const alerts = buildFinancialAlerts({
      monthId: mid,
      transactions: snap.transactions,
      goals: monthGoals,
      cards: snap.cards,
      invoicePayments: snap.invoicePayments,
    });
    return {
      monthId: mid,
      alerts,
      actionableCount: countActionableFinancialAlerts(alerts),
    };
  }

  async getBaselines(
    userId: string,
    monthId: string | undefined,
    period: GoalsPeriodFilter,
  ) {
    const mid = resolveMonthId(monthId);
    const snap = await this.repo.loadForUser(userId);
    const { averages, denominatorLabel } = baselineAverages(
      withoutInvestments(snap.transactions),
      mid,
      period,
    );
    return {
      monthId: mid,
      period,
      averages,
      denominatorLabel,
      cashInvoiceLagMonths: CASH_INVOICE_LAG_MONTHS,
    };
  }

  async investmentSummary(userId: string) {
    const snap = await this.repo.loadForUser(userId);
    const aportes = onlyInvestments(snap.transactions);
    return {
      investmentContributions: sumInvestmentContributions(snap.transactions),
      spendingCount: withoutInvestments(snap.transactions).length,
      aporteCount: aportes.length,
      cashInvoiceLagMonths: CASH_INVOICE_LAG_MONTHS,
    };
  }

  healthRules(category: string) {
    return {
      category,
      isInvestment: isInvestmentCategory(category),
      cashInvoiceLagMonths: CASH_INVOICE_LAG_MONTHS,
    };
  }
}
