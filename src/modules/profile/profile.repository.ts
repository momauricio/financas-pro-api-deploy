import type { UserProfile } from '@prisma/client';
import { prisma } from '../../config/prisma.js';

export type ProfileRecord = UserProfile;

export class ProfileRepository {
  async findByUserId(userId: string): Promise<ProfileRecord | null> {
    return prisma.userProfile.findUnique({ where: { userId } });
  }

  async upsertInitialBalance(userId: string, initialBalance: string): Promise<ProfileRecord> {
    return prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        initialBalance,
      },
      update: {
        initialBalance,
        updatedAt: new Date(),
      },
    });
  }
}
