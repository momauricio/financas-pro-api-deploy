import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import type {
  TransactionCreateInput,
  TransactionRecord,
  TransactionRepositoryPort,
  TransactionUpdateData,
} from './transaction.repo-port.js';

export type { TransactionRecord, TransactionCreateInput } from './transaction.repo-port.js';

export class TransactionRepository implements TransactionRepositoryPort {
  async listByUser(
    userId: string,
    opts: {
      skip: number;
      take: number;
      monthId?: string;
      invoiceMonthId?: string;
    },
  ): Promise<{ rows: TransactionRecord[]; total: number }> {
    const where: Prisma.TransactionWhereInput = {
      userId,
      ...(opts.invoiceMonthId ? { invoiceMonthId: opts.invoiceMonthId } : {}),
      ...(opts.monthId
        ? {
            date: {
              gte: new Date(`${opts.monthId}-01T00:00:00.000Z`),
              lt: (() => {
                const [y, m] = opts.monthId!.split('-').map(Number);
                return m === 12
                  ? new Date(Date.UTC(y + 1, 0, 1))
                  : new Date(Date.UTC(y, m, 1));
              })(),
            },
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: opts.skip,
        take: opts.take,
      }),
      prisma.transaction.count({ where }),
    ]);
    return { rows: rows as TransactionRecord[], total };
  }

  async findByIdForUser(id: string, userId: string): Promise<TransactionRecord | null> {
    return prisma.transaction.findFirst({ where: { id, userId } }) as Promise<TransactionRecord | null>;
  }

  async findCardClosingDay(cardId: string, userId: string): Promise<number | null> {
    const card = await prisma.creditCard.findFirst({
      where: { id: cardId, userId },
      select: { closingDay: true },
    });
    return card?.closingDay ?? null;
  }

  async createMany(rows: TransactionCreateInput[]): Promise<TransactionRecord[]> {
    const created = await prisma.$transaction(
      rows.map((row) =>
        prisma.transaction.create({
          data: {
            userId: row.userId,
            description: row.description,
            amount: row.amount,
            category: row.category,
            date: row.date,
            isPaid: row.isPaid,
            type: row.type,
            isFixed: row.isFixed,
            installments: row.installments ?? undefined,
            paymentMethod: row.paymentMethod ?? undefined,
            cardId: row.cardId ?? undefined,
            invoiceMonthId: row.invoiceMonthId ?? undefined,
            recurringGroupId: row.recurringGroupId ?? undefined,
            refundOfTransactionId: row.refundOfTransactionId ?? undefined,
            investmentAssetId: row.investmentAssetId ?? undefined,
            purchaseUsdRate: row.purchaseUsdRate ?? undefined,
            sharesBought: row.sharesBought ?? undefined,
          },
        }),
      ),
    );
    return created as TransactionRecord[];
  }

  async update(
    id: string,
    userId: string,
    data: TransactionUpdateData,
  ): Promise<TransactionRecord | null> {
    await prisma.transaction.updateMany({
      where: { id, userId },
      data: data as Prisma.TransactionUpdateManyMutationInput,
    });
    return this.findByIdForUser(id, userId);
  }

  async updateByGroup(
    userId: string,
    recurringGroupId: string,
    data: TransactionUpdateData,
    dateFilter?: { gte?: Date; lte?: Date },
  ): Promise<number> {
    const result = await prisma.transaction.updateMany({
      where: {
        userId,
        recurringGroupId,
        ...(dateFilter?.gte || dateFilter?.lte
          ? {
              date: {
                ...(dateFilter.gte ? { gte: dateFilter.gte } : {}),
                ...(dateFilter.lte ? { lte: dateFilter.lte } : {}),
              },
            }
          : {}),
      },
      data: data as Prisma.TransactionUpdateManyMutationInput,
    });
    return result.count;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await prisma.transaction.deleteMany({ where: { id, userId } });
    return result.count > 0;
  }

  async listByGroup(
    userId: string,
    recurringGroupId: string,
    dateFilter?: { gte?: Date; lte?: Date },
  ): Promise<TransactionRecord[]> {
    return prisma.transaction.findMany({
      where: {
        userId,
        recurringGroupId,
        ...(dateFilter?.gte || dateFilter?.lte
          ? {
              date: {
                ...(dateFilter.gte ? { gte: dateFilter.gte } : {}),
                ...(dateFilter.lte ? { lte: dateFilter.lte } : {}),
              },
            }
          : {}),
      },
      orderBy: { date: 'asc' },
    }) as Promise<TransactionRecord[]>;
  }

  async deleteByGroup(
    userId: string,
    recurringGroupId: string,
    dateFilter?: { gte?: Date; lte?: Date },
  ): Promise<number> {
    const result = await prisma.transaction.deleteMany({
      where: {
        userId,
        recurringGroupId,
        ...(dateFilter?.gte || dateFilter?.lte
          ? {
              date: {
                ...(dateFilter.gte ? { gte: dateFilter.gte } : {}),
                ...(dateFilter.lte ? { lte: dateFilter.lte } : {}),
              },
            }
          : {}),
      },
    });
    return result.count;
  }

  async findByRecurringGroup(
    userId: string,
    recurringGroupId: string,
  ): Promise<TransactionRecord[]> {
    return prisma.transaction.findMany({
      where: { userId, recurringGroupId },
      orderBy: { date: 'asc' },
    }) as Promise<TransactionRecord[]>;
  }
}
