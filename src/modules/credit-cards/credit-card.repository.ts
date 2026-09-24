import type { CreditCard, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';

export type CreditCardRecord = CreditCard;

export class CreditCardRepository {
  async listByUser(
    userId: string,
    opts: { skip: number; take: number; active?: boolean },
  ): Promise<{ rows: CreditCardRecord[]; total: number }> {
    const where: Prisma.CreditCardWhereInput = {
      userId,
      ...(opts.active === undefined ? {} : { active: opts.active }),
    };
    const [rows, total] = await Promise.all([
      prisma.creditCard.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: opts.skip,
        take: opts.take,
      }),
      prisma.creditCard.count({ where }),
    ]);
    return { rows, total };
  }

  async findByIdForUser(id: string, userId: string): Promise<CreditCardRecord | null> {
    return prisma.creditCard.findFirst({ where: { id, userId } });
  }

  async create(data: {
    userId: string;
    name: string;
    brand?: string | null;
    creditLimit: string;
    closingDay: number;
    dueDay: number;
    active: boolean;
  }): Promise<CreditCardRecord> {
    return prisma.creditCard.create({
      data: {
        userId: data.userId,
        name: data.name,
        brand: data.brand ?? null,
        creditLimit: data.creditLimit,
        closingDay: data.closingDay,
        dueDay: data.dueDay,
        active: data.active,
      },
    });
  }

  async update(
    id: string,
    userId: string,
    data: Partial<{
      name: string;
      brand: string | null;
      creditLimit: string;
      closingDay: number;
      dueDay: number;
      active: boolean;
    }>,
  ): Promise<CreditCardRecord> {
    await prisma.creditCard.updateMany({
      where: { id, userId },
      data,
    });
    const updated = await this.findByIdForUser(id, userId);
    if (!updated) {
      throw new Error('Credit card update vanished');
    }
    return updated;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await prisma.creditCard.deleteMany({ where: { id, userId } });
    return result.count > 0;
  }
}
