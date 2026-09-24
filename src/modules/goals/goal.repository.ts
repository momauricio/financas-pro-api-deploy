import type { Goal, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';

export type GoalRecord = Goal;

export class GoalRepository {
  async listByUser(
    userId: string,
    opts: { skip: number; take: number; monthId?: string },
  ): Promise<{ rows: GoalRecord[]; total: number }> {
    const where: Prisma.GoalWhereInput = {
      userId,
      ...(opts.monthId ? { monthId: opts.monthId } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.goal.findMany({
        where,
        orderBy: [{ monthId: 'desc' }, { category: 'asc' }],
        skip: opts.skip,
        take: opts.take,
      }),
      prisma.goal.count({ where }),
    ]);
    return { rows, total };
  }

  async findByKey(
    userId: string,
    monthId: string,
    category: string,
  ): Promise<GoalRecord | null> {
    return prisma.goal.findFirst({
      where: { userId, monthId, category },
    });
  }

  async upsert(data: {
    userId: string;
    monthId: string;
    category: string;
    amount: string;
  }): Promise<GoalRecord> {
    return prisma.goal.upsert({
      where: {
        userId_monthId_category: {
          userId: data.userId,
          monthId: data.monthId,
          category: data.category,
        },
      },
      create: {
        userId: data.userId,
        monthId: data.monthId,
        category: data.category,
        amount: data.amount,
      },
      update: {
        amount: data.amount,
      },
    });
  }

  async upsertMany(
    userId: string,
    monthId: string,
    goals: { category: string; amount: string }[],
  ): Promise<GoalRecord[]> {
    const results: GoalRecord[] = [];
    for (const g of goals) {
      results.push(
        await this.upsert({
          userId,
          monthId,
          category: g.category,
          amount: g.amount,
        }),
      );
    }
    return results;
  }
}
