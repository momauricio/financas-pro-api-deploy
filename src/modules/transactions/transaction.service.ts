import { createHash, randomUUID } from 'node:crypto';
import { writeAuditLog } from '../../shared/middlewares/audit.js';
import {
  DuplicateTransactionError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors/index.js';
import {
  addMonthsToDateId,
  calculateInvoiceMonthId,
  dateIdInMonth,
  parseDateId,
} from '../../shared/utils/dates.js';
import { money, moneyToString, splitInstallmentAmount } from '../../shared/utils/money.js';
import type {
  CreateTransactionBody,
  ReplicateTransactionBody,
  UpdateTransactionBody,
} from './transaction.schema.js';
import type {
  TransactionCreateInput,
  TransactionRecord,
  TransactionRepositoryPort,
} from './transaction.repo-port.js';
import type {
  InstallmentActionScope,
  InstallmentsDto,
  PaginatedTransactions,
  TransactionDto,
} from './transaction.types.js';

/** Parity with front `lib/expenseAggregates.isInvestmentCategory`. */
export function isInvestmentCategory(category: string): boolean {
  const n = category.toLowerCase();
  return n.includes('investimento') || n.includes('invest');
}

function dateToId(value: Date | string): string {
  if (typeof value === 'string') {
    return value.substring(0, 10);
  }
  // Prisma @db.Date often comes as UTC midnight — use UTC Y-M-D.
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, '0');
  const d = String(value.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseInstallments(raw: unknown): InstallmentsDto | undefined {
  if (raw == null || typeof raw !== 'object') return undefined;
  const obj = raw as { current?: unknown; total?: unknown };
  const current = Number(obj.current);
  const total = Number(obj.total);
  if (!Number.isFinite(current) || !Number.isFinite(total)) return undefined;
  return { current, total };
}

function optionalNumber(
  raw: { toString(): string } | string | number | null | undefined,
): number | null {
  if (raw == null) return null;
  return Number(moneyToString(money(typeof raw === 'number' ? raw : raw.toString())));
}

function amountToString(raw: TransactionRecord['amount']): string {
  if (typeof raw === 'number') return moneyToString(money(raw));
  return moneyToString(money(raw.toString()));
}


function amountAbsMoney(raw: TransactionRecord['amount'] | string | number) {
  const value =
    typeof raw === 'number' ? money(raw) : money(typeof raw === 'string' ? raw : raw.toString());
  return value.abs();
}

/** Remaining amount that can still be refunded for an original purchase. */
export function computeRefundRemaining(
  originalAmount: TransactionRecord['amount'] | string | number,
  refundRows: Array<{ amount: TransactionRecord['amount'] | string | number }>,
): { originalAbs: string; refundedAbs: string; remainingAbs: string } {
  const originalAbs = amountAbsMoney(originalAmount);
  let refundedAbs = money(0);
  for (const row of refundRows) {
    refundedAbs = refundedAbs.plus(amountAbsMoney(row.amount));
  }
  const remainingAbs = DecimalMaxZero(originalAbs.minus(refundedAbs));
  return {
    originalAbs: moneyToString(originalAbs),
    refundedAbs: moneyToString(refundedAbs),
    remainingAbs: moneyToString(remainingAbs),
  };
}

function DecimalMaxZero(value: ReturnType<typeof money>) {
  return value.isNeg() ? money(0) : value;
}

export function toDto(row: TransactionRecord): TransactionDto {
  return {
    id: row.id,
    description: row.description,
    amount: Number(amountToString(row.amount)),
    category: row.category,
    date: dateToId(row.date),
    isPaid: row.isPaid ?? false,
    type: row.type as TransactionDto['type'],
    isFixed: row.isFixed ?? false,
    installments: parseInstallments(row.installments),
    paymentMethod: (row.paymentMethod as TransactionDto['paymentMethod']) ?? null,
    cardId: row.cardId ?? null,
    invoiceMonthId: row.invoiceMonthId ?? null,
    recurringGroupId: row.recurringGroupId ?? null,
    refundOfTransactionId: row.refundOfTransactionId ?? null,
    investmentAssetId: row.investmentAssetId ?? null,
    purchaseUsdRate: optionalNumber(row.purchaseUsdRate),
    sharesBought: optionalNumber(row.sharesBought),
  };
}

export function uuidFromIdempotencyKey(key: string): string {
  const hex = createHash('sha1').update(`financas-pro:${key}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export class TransactionService {
  constructor(private readonly repo: TransactionRepositoryPort) {}

  async list(
    userId: string,
    query: { page: number; pageSize: number; monthId?: string; invoiceMonthId?: string },
  ): Promise<PaginatedTransactions> {
    const skip = (query.page - 1) * query.pageSize;
    const { rows, total } = await this.repo.listByUser(userId, {
      skip,
      take: query.pageSize,
      monthId: query.monthId,
      invoiceMonthId: query.invoiceMonthId,
    });
    return {
      items: rows.map(toDto),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }


  async getRefundable(
    userId: string,
    originalId: string,
  ): Promise<{
    originalTransactionId: string;
    originalAmount: number;
    refundedAmount: number;
    remainingAmount: number;
    refundCount: number;
  }> {
    const original = await this.repo.findByIdForUser(originalId, userId);
    if (!original) {
      throw new NotFoundError('Transaction not found');
    }
    if (original.refundOfTransactionId) {
      throw new ValidationError('Refund rows cannot be refunded');
    }
    const refunds = await this.repo.listRefundsOf(userId, originalId);
    const { originalAbs, refundedAbs, remainingAbs } = computeRefundRemaining(
      original.amount,
      refunds,
    );
    return {
      originalTransactionId: originalId,
      originalAmount: Number(originalAbs),
      refundedAmount: Number(refundedAbs),
      remainingAmount: Number(remainingAbs),
      refundCount: refunds.length,
    };
  }

  /**
   * Cancel (undo) a refund row: delete it and recompute remaining on the original.
   * Only rows with `refundOfTransactionId` may be cancelled this way — not arbitrary txs.
   */
  async cancelRefund(
    userId: string,
    refundId: string,
  ): Promise<{
    cancelledRefundId: string;
    originalTransactionId: string;
    restoredAmount: number;
    remainingAmount: number;
    refundCount: number;
  }> {
    const refund = await this.repo.findByIdForUser(refundId, userId);
    if (!refund) {
      throw new NotFoundError('Transaction not found');
    }
    if (!refund.refundOfTransactionId) {
      throw new ValidationError('Only refund transactions can be cancelled');
    }

    const originalId = refund.refundOfTransactionId;
    const restoredAbs = amountAbsMoney(refund.amount);

    const ok = await this.repo.delete(refundId, userId);
    if (!ok) {
      throw new NotFoundError('Transaction not found');
    }

    const original = await this.repo.findByIdForUser(originalId, userId);
    let remainingAmount = 0;
    let refundCount = 0;
    if (original) {
      const remainingRefunds = await this.repo.listRefundsOf(userId, originalId);
      const { remainingAbs } = computeRefundRemaining(original.amount, remainingRefunds);
      remainingAmount = Number(remainingAbs);
      refundCount = remainingRefunds.length;
    }

    await writeAuditLog({
      userId,
      action: 'delete',
      entityType: 'transaction',
      entityId: refundId,
      metadata: {
        cancelRefund: true,
        refundOfTransactionId: originalId,
        restoredAmount: moneyToString(restoredAbs),
        remainingAfter: moneyToString(money(remainingAmount)),
        refundCountAfter: refundCount,
      },
    });

    return {
      cancelledRefundId: refundId,
      originalTransactionId: originalId,
      restoredAmount: Number(moneyToString(restoredAbs)),
      remainingAmount,
      refundCount,
    };
  }

  async create(userId: string, body: CreateTransactionBody): Promise<TransactionDto[]> {
    if (!body.description.trim()) {
      throw new ValidationError('Description is required');
    }

    let refundNormalizedAmount: string | null = null;
    let refundAudit:
      | {
          originalId: string;
          refundAmount: string;
          remainingAfter: string;
          refundCountBefore: number;
        }
      | null = null;

    if (body.refundOfTransactionId) {
      if (body.isFixed || (body.installments && body.installments.total > 1)) {
        throw new ValidationError('Refunds cannot expand into fixed/installment series');
      }

      const original = await this.repo.findByIdForUser(body.refundOfTransactionId, userId);
      if (!original) {
        throw new NotFoundError('Original transaction for refund not found');
      }
      if (original.refundOfTransactionId) {
        throw new ValidationError('Cannot refund a refund transaction');
      }

      const existingRefunds = await this.repo.listRefundsOf(userId, body.refundOfTransactionId);
      const { remainingAbs } = computeRefundRemaining(original.amount, existingRefunds);
      const remaining = money(remainingAbs);
      if (remaining.lte(0)) {
        throw new ValidationError('Transaction is already fully refunded');
      }

      const requested = money(body.amount).abs();
      if (requested.lte(0)) {
        throw new ValidationError('Refund amount must be greater than zero');
      }
      if (requested.gt(remaining)) {
        throw new ValidationError(
          `Refund amount exceeds remaining refundable (${moneyToString(remaining)})`,
        );
      }

      // Canonical refund row: negative amount (credit on the invoice).
      refundNormalizedAmount = moneyToString(requested.neg());
      refundAudit = {
        originalId: body.refundOfTransactionId,
        refundAmount: moneyToString(requested),
        remainingAfter: moneyToString(remaining.minus(requested)),
        refundCountBefore: existingRefunds.length,
      };
    }

    const installmentTotal =
      !body.isFixed && body.installments && body.installments.total > 1
        ? body.installments.total
        : 1;
    const iterations = body.isFixed ? 12 : installmentTotal;
    const needsGroup = body.isFixed || installmentTotal > 1 || Boolean(body.idempotencyKey);

    let recurringGroupId: string | null = null;
    if (needsGroup) {
      recurringGroupId = body.idempotencyKey
        ? uuidFromIdempotencyKey(body.idempotencyKey)
        : randomUUID();
      const existing = await this.repo.findByRecurringGroup(userId, recurringGroupId);
      if (existing.length > 0) {
        throw new DuplicateTransactionError(
          'Idempotent create: transactions already exist for this key',
        );
      }
    }

    let closingDay: number | null = null;
    if (body.paymentMethod === 'Crédito' && body.cardId) {
      closingDay = await this.repo.findCardClosingDay(body.cardId, userId);
      if (closingDay == null) {
        throw new NotFoundError('Credit card not found');
      }
    }

    const amountParts =
      installmentTotal > 1
        ? splitInstallmentAmount(body.amount, installmentTotal)
        : [refundNormalizedAmount ?? moneyToString(money(body.amount))];

    const invest = isInvestmentCategory(body.category);
    const rows: TransactionCreateInput[] = [];

    for (let i = 0; i < iterations; i += 1) {
      const dateStr = addMonthsToDateId(body.date, i);
      const invoiceMonthId =
        body.invoiceMonthId ??
        (body.paymentMethod === 'Crédito'
          ? calculateInvoiceMonthId(dateStr, closingDay)
          : dateStr.substring(0, 7));

      const amountStr =
        installmentTotal > 1 ? (amountParts[i] as string) : (amountParts[0] as string);

      rows.push({
        userId,
        description: body.description.trim(),
        amount: amountStr,
        category: body.category.trim(),
        date: parseDateId(dateStr),
        isPaid: body.isPaid,
        type: body.type,
        isFixed: body.isFixed,
        installments:
          body.installments && body.installments.total > 1
            ? { current: i + 1, total: body.installments.total }
            : null,
        paymentMethod: body.paymentMethod ?? null,
        cardId: body.cardId ?? null,
        invoiceMonthId,
        recurringGroupId,
        refundOfTransactionId: body.refundOfTransactionId ?? null,
        investmentAssetId: invest ? body.investmentAssetId ?? null : null,
        purchaseUsdRate:
          invest && body.purchaseUsdRate != null
            ? moneyToString(money(body.purchaseUsdRate), 6)
            : null,
        sharesBought:
          invest && body.sharesBought != null
            ? moneyToString(money(body.sharesBought), 8)
            : null,
      });
    }

    const created = await this.repo.createMany(rows);

    await writeAuditLog({
      userId,
      action: 'create',
      entityType: 'transaction',
      entityId: created[0]?.id ?? null,
      metadata: {
        count: created.length,
        isFixed: body.isFixed,
        installmentTotal,
        hasRefund: Boolean(body.refundOfTransactionId),
        ...(refundAudit
          ? {
              refundOfTransactionId: refundAudit.originalId,
              refundAmount: refundAudit.refundAmount,
              remainingAfter: refundAudit.remainingAfter,
              refundCountBefore: refundAudit.refundCountBefore,
              partial: money(refundAudit.remainingAfter).gt(0),
            }
          : {}),
      },
    });

    return created.map(toDto);
  }

  async update(
    userId: string,
    id: string,
    body: UpdateTransactionBody,
  ): Promise<{ updated: number; item?: TransactionDto }> {
    const current = await this.repo.findByIdForUser(id, userId);
    if (!current) {
      throw new NotFoundError('Transaction not found');
    }

    const scope: InstallmentActionScope = body.scope ?? 'current';
    const {
      scope: _scope,
      amount,
      date,
      installments,
      invoiceMonthId,
      purchaseUsdRate,
      sharesBought,
      category,
      ...rest
    } = body;

    const data: Record<string, unknown> = { ...rest };

    if (amount !== undefined) {
      data.amount = moneyToString(money(amount));
    }
    if (date !== undefined) {
      data.date = parseDateId(date);
    }
    if (installments !== undefined) {
      data.installments = installments;
    }
    if (invoiceMonthId !== undefined) {
      data.invoiceMonthId = invoiceMonthId;
    }
    if (purchaseUsdRate !== undefined) {
      data.purchaseUsdRate =
        purchaseUsdRate == null ? null : moneyToString(money(purchaseUsdRate), 6);
    }
    if (sharesBought !== undefined) {
      data.sharesBought =
        sharesBought == null ? null : moneyToString(money(sharesBought), 8);
    }
    if (category !== undefined) {
      data.category = category.trim();
      if (!isInvestmentCategory(category)) {
        data.investmentAssetId = null;
        data.purchaseUsdRate = null;
        data.sharesBought = null;
      }
    }

    if (scope === 'current') {
      const updated = await this.repo.update(id, userId, data);
      if (!updated) throw new NotFoundError('Transaction not found');
      await writeAuditLog({
        userId,
        action: 'update',
        entityType: 'transaction',
        entityId: id,
        metadata: { scope },
      });
      return { updated: 1, item: toDto(updated) };
    }

    if (!current.recurringGroupId) {
      throw new ValidationError('Scope update requires a recurring group');
    }

    const {
      date: _d,
      installments: _i,
      invoiceMonthId: _im,
      ...common
    } = data;

    const dateFilter =
      scope === 'future'
        ? { gte: current.date instanceof Date ? current.date : parseDateId(String(current.date)) }
        : scope === 'past'
          ? { lte: current.date instanceof Date ? current.date : parseDateId(String(current.date)) }
          : undefined;

    const count = await this.repo.updateByGroup(
      userId,
      current.recurringGroupId,
      common,
      dateFilter,
    );

    await writeAuditLog({
      userId,
      action: 'update',
      entityType: 'transaction',
      entityId: id,
      metadata: { scope, count },
    });

    const refreshed = await this.repo.findByIdForUser(id, userId);
    return { updated: count, item: refreshed ? toDto(refreshed) : undefined };
  }

  async delete(
    userId: string,
    id: string,
    scope: InstallmentActionScope = 'current',
  ): Promise<{ deleted: number }> {
    const current = await this.repo.findByIdForUser(id, userId);
    if (!current) {
      throw new NotFoundError('Transaction not found');
    }

    if (scope === 'current') {
      const ok = await this.repo.delete(id, userId);
      if (!ok) throw new NotFoundError('Transaction not found');
      await writeAuditLog({
        userId,
        action: 'delete',
        entityType: 'transaction',
        entityId: id,
        metadata: { scope },
      });
      return { deleted: 1 };
    }

    if (!current.recurringGroupId) {
      throw new ValidationError('Scope delete requires a recurring group');
    }

    const dateFilter =
      scope === 'future'
        ? { gte: current.date instanceof Date ? current.date : parseDateId(String(current.date)) }
        : scope === 'past'
          ? { lte: current.date instanceof Date ? current.date : parseDateId(String(current.date)) }
          : undefined;

    const deleted = await this.repo.deleteByGroup(
      userId,
      current.recurringGroupId,
      dateFilter,
    );

    await writeAuditLog({
      userId,
      action: 'delete',
      entityType: 'transaction',
      entityId: id,
      metadata: { scope, deleted },
    });

    return { deleted };
  }

  async replicate(
    userId: string,
    id: string,
    body: ReplicateTransactionBody,
  ): Promise<{ created: number; items: TransactionDto[] }> {
    const source = await this.repo.findByIdForUser(id, userId);
    if (!source) {
      throw new NotFoundError('Transaction not found');
    }

    const sourceDate = dateToId(source.date);
    const sourceMonthId = sourceDate.substring(0, 7);
    const dayOfMonth = Number(sourceDate.substring(8, 10)) || 1;
    const uniqueMonthIds = [...new Set(body.monthIds)].filter((m) => m !== sourceMonthId);
    if (uniqueMonthIds.length === 0) {
      return { created: 0, items: [] };
    }

    let closingDay: number | null = null;
    if (source.paymentMethod === 'Crédito' && source.cardId) {
      closingDay = await this.repo.findCardClosingDay(source.cardId, userId);
    }

    const rows: TransactionCreateInput[] = uniqueMonthIds.map((monthId) => {
      const dateStr = dateIdInMonth(monthId, dayOfMonth);
      const invoiceMonthId =
        source.paymentMethod === 'Crédito'
          ? calculateInvoiceMonthId(dateStr, closingDay)
          : dateStr.substring(0, 7);
      return {
        userId,
        description: source.description,
        amount: amountToString(source.amount),
        category: source.category,
        date: parseDateId(dateStr),
        isPaid: false,
        type: source.type,
        isFixed: false,
        installments: null,
        paymentMethod: source.paymentMethod,
        cardId: source.cardId,
        invoiceMonthId,
        recurringGroupId: null,
        refundOfTransactionId: null,
        investmentAssetId: source.investmentAssetId,
        purchaseUsdRate:
          source.purchaseUsdRate != null
            ? moneyToString(
                money(
                  typeof source.purchaseUsdRate === 'number'
                    ? source.purchaseUsdRate
                    : source.purchaseUsdRate.toString(),
                ),
                6,
              )
            : null,
        sharesBought:
          source.sharesBought != null
            ? moneyToString(
                money(
                  typeof source.sharesBought === 'number'
                    ? source.sharesBought
                    : source.sharesBought.toString(),
                ),
                8,
              )
            : null,
      };
    });

    const created = await this.repo.createMany(rows);
    await writeAuditLog({
      userId,
      action: 'create',
      entityType: 'transaction',
      entityId: source.id,
      metadata: { replicate: true, count: created.length },
    });
    return { created: created.length, items: created.map(toDto) };
  }
}
