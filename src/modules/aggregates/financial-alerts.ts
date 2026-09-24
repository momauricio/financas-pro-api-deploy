/**
 * Server-side financial alerts (advisory).
 * Dismiss state stays client-side (localStorage); API returns the full set.
 */

import {
  daysBetween,
  dateIdInMonth,
  toDateId,
  toMonthId,
} from '../../shared/utils/dates.js';
import {
  expensesForMonth,
  isSpendingGoalCategory,
  monthSpendTotal,
  sumByCategory,
  sumGoalsTotal,
  withoutInvestments,
  type TxLike,
} from './expense-aggregates.js';
import { money, moneyToNumber } from '../../shared/utils/money.js';

export type FinancialAlertSeverity = 'critical' | 'warning' | 'info';

export type FinancialAlertKind =
  | 'budget_breached'
  | 'budget_near'
  | 'category_breached'
  | 'invoice_overdue'
  | 'invoice_due_soon'
  | 'unpaid_income'
  | 'installments_due';

export type FinancialAlert = {
  id: string;
  kind: FinancialAlertKind;
  severity: FinancialAlertSeverity;
  title: string;
  description: string;
  hrefTab?: 'dashboard' | 'comparison' | 'cards' | 'alerts';
  amount?: number;
  meta?: Record<string, string | number>;
};

export type CardLike = {
  id: string;
  name: string;
  dueDay: number;
  active: boolean;
};

export type GoalLike = {
  category: string;
  amount: number;
};

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    val,
  );

export function invoiceTotalForCard(
  transactions: TxLike[],
  cardId: string,
  invoiceMonthId: string,
): number {
  return moneyToNumber(
    transactions
      .filter(
        (t) =>
          t.cardId === cardId &&
          (t.invoiceMonthId || t.date.substring(0, 7)) === invoiceMonthId,
      )
      .reduce((s, t) => s.plus(money(t.amount)), money(0)),
  );
}

export function buildFinancialAlerts(input: {
  monthId: string;
  transactions: TxLike[];
  goals: GoalLike[];
  cards: CardLike[];
  /** key = `${monthId}-${cardId}` → paid */
  invoicePayments: Record<string, boolean>;
  today?: Date;
  dismissedIds?: Set<string>;
}): FinancialAlert[] {
  const today = input.today ?? new Date();
  const todayId = toDateId(today);
  const todayMonthId = toMonthId(today);
  const monthId = input.monthId;
  const dismissed = input.dismissedIds ?? new Set<string>();
  const txs = input.transactions;
  const alerts: FinancialAlert[] = [];

  const goals = input.goals.filter((g) => isSpendingGoalCategory(g.category));
  const ceiling = sumGoalsTotal(goals);
  const spend = monthSpendTotal(withoutInvestments(txs), monthId);

  if (ceiling > 0) {
    const ratio = spend / ceiling;
    if (spend > ceiling) {
      alerts.push({
        id: `budget_breached:${monthId}`,
        kind: 'budget_breached',
        severity: 'critical',
        title: 'Teto de gastos estourado',
        description: `Você já gastou ${formatCurrency(spend)} de ${formatCurrency(ceiling)} neste mês (${Math.round(ratio * 100)}%).`,
        hrefTab: 'comparison',
        amount: Math.round((spend - ceiling) * 100) / 100,
      });
    } else if (ratio >= 0.8) {
      alerts.push({
        id: `budget_near:${monthId}`,
        kind: 'budget_near',
        severity: 'warning',
        title: 'Teto de gastos quase no limite',
        description: `${Math.round(ratio * 100)}% do teto usado — restam ${formatCurrency(ceiling - spend)}.`,
        hrefTab: 'comparison',
        amount: Math.round((ceiling - spend) * 100) / 100,
      });
    }

    const spentByCat = sumByCategory(
      expensesForMonth(withoutInvestments(txs), monthId),
    );
    goals.forEach((g) => {
      if (!(g.amount > 0)) return;
      const used = Math.max(0, spentByCat[g.category] || 0);
      if (used > g.amount) {
        alerts.push({
          id: `category_breached:${monthId}:${g.category}`,
          kind: 'category_breached',
          severity: 'warning',
          title: `Meta estourada: ${g.category}`,
          description: `${formatCurrency(used)} de ${formatCurrency(g.amount)} — ${formatCurrency(used - g.amount)} acima.`,
          hrefTab: 'comparison',
          amount: Math.round((used - g.amount) * 100) / 100,
          meta: { category: g.category },
        });
      }
    });
  }

  const invoiceMonthId = monthId;
  input.cards
    .filter((c) => c.active)
    .forEach((card) => {
      const total = invoiceTotalForCard(txs, card.id, invoiceMonthId);
      if (Math.abs(total) < 0.005) return;
      const paid = !!input.invoicePayments[`${invoiceMonthId}-${card.id}`];
      if (paid || total < 0) return;

      const dueId = dateIdInMonth(invoiceMonthId, card.dueDay);
      const delta = daysBetween(todayId, dueId);
      const isCurrentCivilMonth = invoiceMonthId === todayMonthId;

      if (delta < 0) {
        alerts.push({
          id: `invoice_overdue:${invoiceMonthId}:${card.id}`,
          kind: 'invoice_overdue',
          severity: 'critical',
          title: `Fatura atrasada: ${card.name}`,
          description: `Venceu no dia ${card.dueDay} — valor ${formatCurrency(total)}.`,
          hrefTab: 'dashboard',
          amount: total,
          meta: { cardId: card.id },
        });
      } else if (isCurrentCivilMonth && delta <= 5) {
        alerts.push({
          id: `invoice_due_soon:${invoiceMonthId}:${card.id}`,
          kind: 'invoice_due_soon',
          severity: delta <= 2 ? 'critical' : 'warning',
          title: `Fatura vence em breve: ${card.name}`,
          description:
            delta === 0
              ? `Vence hoje — ${formatCurrency(total)}.`
              : `Vence em ${delta} dia${delta === 1 ? '' : 's'} (dia ${card.dueDay}) — ${formatCurrency(total)}.`,
          hrefTab: 'dashboard',
          amount: total,
          meta: { cardId: card.id },
        });
      }
    });

  if (monthId === todayMonthId) {
    const unpaidIncome = txs.filter(
      (t) =>
        t.type === 'income' &&
        !t.isPaid &&
        t.amount > 0 &&
        t.date.substring(0, 7) === monthId,
    );
    if (unpaidIncome.length > 0) {
      const sum = moneyToNumber(
        unpaidIncome.reduce((s, t) => s.plus(money(t.amount)), money(0)),
      );
      alerts.push({
        id: `unpaid_income:${monthId}`,
        kind: 'unpaid_income',
        severity: 'info',
        title: 'Entradas a confirmar',
        description: `${unpaidIncome.length} ganho${unpaidIncome.length === 1 ? '' : 's'} ainda não marcado${unpaidIncome.length === 1 ? '' : 's'} como recebido (${formatCurrency(sum)}).`,
        hrefTab: 'dashboard',
        amount: sum,
      });
    }
  }

  const installmentTx = expensesForMonth(txs, monthId).filter(
    (t) => t.installments && t.installments.total > 1,
  );
  if (installmentTx.length > 0) {
    const sum = moneyToNumber(
      installmentTx.reduce(
        (s, t) => s.plus(money(Math.max(0, t.amount))),
        money(0),
      ),
    );
    alerts.push({
      id: `installments_due:${monthId}`,
      kind: 'installments_due',
      severity: 'info',
      title: 'Parcelas neste mês',
      description: `${installmentTx.length} parcela${installmentTx.length === 1 ? '' : 's'} somando ${formatCurrency(sum)}.`,
      hrefTab: 'dashboard',
      amount: sum,
    });
  }

  const severityRank: Record<FinancialAlertSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  return alerts
    .filter((a) => !dismissed.has(a.id))
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}

export function countActionableFinancialAlerts(
  alerts: FinancialAlert[],
): number {
  return alerts.filter(
    (a) => a.severity === 'critical' || a.severity === 'warning',
  ).length;
}
