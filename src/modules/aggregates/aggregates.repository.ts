import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { moneyToNumber, money } from '../../shared/utils/money.js';
import type { CashTx, GoalLike } from './cash-projection.js';
import type { CardLike } from './financial-alerts.js';
import type { TxLike } from './expense-aggregates.js';

function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  return moneyToNumber(money(value.toString()));
}

function mapTx(row: {
  id: string;
  type: string;
  category: string;
  amount: Prisma.Decimal;
  date: Date;
  invoiceMonthId: string | null;
  paymentMethod: string | null;
  isPaid: boolean | null;
  isFixed: boolean | null;
  cardId: string | null;
  recurringGroupId: string | null;
  installments: Prisma.JsonValue | null;
}): CashTx & TxLike {
  const dateStr =
    row.date instanceof Date
      ? row.date.toISOString().slice(0, 10)
      : String(row.date).slice(0, 10);

  let installments: { current: number; total: number } | null = null;
  if (
    row.installments &&
    typeof row.installments === 'object' &&
    !Array.isArray(row.installments)
  ) {
    const raw = row.installments as { current?: unknown; total?: unknown };
    if (typeof raw.current === 'number' && typeof raw.total === 'number') {
      installments = { current: raw.current, total: raw.total };
    }
  }

  return {
    id: row.id,
    type: row.type,
    category: row.category,
    amount: decimalToNumber(row.amount),
    date: dateStr,
    invoiceMonthId: row.invoiceMonthId,
    paymentMethod: row.paymentMethod,
    isPaid: row.isPaid,
    isFixed: row.isFixed,
    cardId: row.cardId,
    recurringGroupId: row.recurringGroupId,
    installments,
  };
}

export type AggregatesSnapshot = {
  transactions: CashTx[];
  goals: GoalLike[];
  initialBalance: number;
  knownMonthIds: string[];
  cards: CardLike[];
  invoicePayments: Record<string, boolean>;
  categories: { name: string; type: string; active: boolean }[];
};

export class AggregatesRepository {
  async loadForUser(userId: string): Promise<AggregatesSnapshot> {
    const [txs, goals, profile, cards, payments, categories] =
      await Promise.all([
        prisma.transaction.findMany({
          where: { userId },
          orderBy: { date: 'asc' },
        }),
        prisma.goal.findMany({ where: { userId } }),
        prisma.userProfile.findUnique({ where: { userId } }),
        prisma.creditCard.findMany({ where: { userId } }),
        prisma.invoicePayment.findMany({ where: { userId } }),
        prisma.category.findMany({ where: { userId } }),
      ]);

    const transactions = txs.map(mapTx);
    const goalLikes: GoalLike[] = goals.map((g) => ({
      monthId: g.monthId,
      category: g.category,
      amount: decimalToNumber(g.amount),
    }));

    const monthSet = new Set<string>();
    transactions.forEach((t) => {
      monthSet.add(t.date.substring(0, 7));
      if (t.invoiceMonthId) monthSet.add(t.invoiceMonthId);
    });
    goalLikes.forEach((g) => monthSet.add(g.monthId));

    const invoicePayments: Record<string, boolean> = {};
    payments.forEach((p) => {
      if (p.cardId) {
        invoicePayments[`${p.monthId}-${p.cardId}`] = !!p.isPaid;
      }
    });

    return {
      transactions,
      goals: goalLikes,
      initialBalance: decimalToNumber(profile?.initialBalance ?? 0),
      knownMonthIds: [...monthSet].sort(),
      cards: cards.map((c) => ({
        id: c.id,
        name: c.name,
        dueDay: c.dueDay,
        active: c.active ?? true,
      })),
      invoicePayments,
      categories: categories.map((c) => ({
        name: c.name,
        type: c.type,
        active: c.active ?? true,
      })),
    };
  }
}
