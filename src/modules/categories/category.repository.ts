import type { Category, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';

export type CategoryRecord = Category;

export class CategoryRepository {
  async listByUser(
    userId: string,
    opts: { skip: number; take: number; active?: boolean },
  ): Promise<{ rows: CategoryRecord[]; total: number }> {
    const where: Prisma.CategoryWhereInput = {
      userId,
      ...(opts.active === undefined ? {} : { active: opts.active }),
    };
    const [rows, total] = await Promise.all([
      prisma.category.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: opts.skip,
        take: opts.take,
      }),
      prisma.category.count({ where }),
    ]);
    return { rows, total };
  }

  async findByIdForUser(id: string, userId: string): Promise<CategoryRecord | null> {
    return prisma.category.findFirst({ where: { id, userId } });
  }

  async create(data: {
    userId: string;
    name: string;
    type: string;
    color: string;
    active: boolean;
  }): Promise<CategoryRecord> {
    return prisma.category.create({
      data: {
        userId: data.userId,
        name: data.name,
        type: data.type,
        color: data.color,
        active: data.active,
      },
    });
  }

  async update(
    id: string,
    userId: string,
    data: Partial<{ name: string; type: string; color: string; active: boolean }>,
  ): Promise<CategoryRecord> {
    // Ownership already verified by service; still scope update.
    await prisma.category.updateMany({
      where: { id, userId },
      data,
    });
    const updated = await this.findByIdForUser(id, userId);
    if (!updated) {
      throw new Error('Category update vanished');
    }
    return updated;
  }

  /**
   * Rename category and cascade string references on transactions/goals
   * inside a single DB transaction (parity with store.updateCategory).
   */
  async renameWithCascade(params: {
    id: string;
    userId: string;
    oldName: string;
    nextName: string;
    otherUpdates: Partial<{ type: string; color: string; active: boolean }>;
  }): Promise<CategoryRecord> {
    return prisma.$transaction(async (tx) => {
      await tx.category.updateMany({
        where: { id: params.id, userId: params.userId },
        data: { name: params.nextName, ...params.otherUpdates },
      });
      await tx.transaction.updateMany({
        where: { userId: params.userId, category: params.oldName },
        data: { category: params.nextName },
      });
      await tx.goal.updateMany({
        where: { userId: params.userId, category: params.oldName },
        data: { category: params.nextName },
      });
      const updated = await tx.category.findFirst({
        where: { id: params.id, userId: params.userId },
      });
      if (!updated) {
        throw new Error('Category rename vanished');
      }
      return updated;
    });
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await prisma.category.deleteMany({ where: { id, userId } });
    return result.count > 0;
  }
}
