import type { InvoicePayment, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';

export type InvoicePaymentRecord = InvoicePayment;

export class InvoicePaymentRepository {
  async listByUser(
    userId: string,
    opts: { skip: number; take: number; monthId?: string; cardId?: string },
  ): Promise<{ rows: InvoicePaymentRecord[]; total: number }> {
    const where: Prisma.InvoicePaymentWhereInput = {
      userId,
      ...(opts.monthId ? { monthId: opts.monthId } : {}),
      ...(opts.cardId ? { cardId: opts.cardId } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.invoicePayment.findMany({
        where,
        orderBy: [{ monthId: 'desc' }, { cardId: 'asc' }],
        skip: opts.skip,
        take: opts.take,
      }),
      prisma.invoicePayment.count({ where }),
    ]);
    return { rows, total };
  }

  async findByKey(
    userId: string,
    monthId: string,
    cardId: string,
  ): Promise<InvoicePaymentRecord | null> {
    return prisma.invoicePayment.findFirst({
      where: { userId, monthId, cardId },
    });
  }

  async upsert(data: {
    userId: string;
    monthId: string;
    cardId: string;
    isPaid: boolean;
  }): Promise<InvoicePaymentRecord> {
    return prisma.invoicePayment.upsert({
      where: {
        userId_monthId_cardId: {
          userId: data.userId,
          monthId: data.monthId,
          cardId: data.cardId,
        },
      },
      create: {
        userId: data.userId,
        monthId: data.monthId,
        cardId: data.cardId,
        isPaid: data.isPaid,
      },
      update: {
        isPaid: data.isPaid,
      },
    });
  }
}
