import { writeAuditLog } from '../../shared/middlewares/audit.js';
import { money, moneyToString } from '../../shared/utils/money.js';
import type { UpdateInitialBalanceBody } from './profile.schema.js';
import { ProfileRepository, type ProfileRecord } from './profile.repository.js';
import type { ProfileDto } from './profile.types.js';

function toDto(row: ProfileRecord): ProfileDto {
  const raw = row.initialBalance ?? 0;
  return {
    userId: row.userId,
    initialBalance: Number(moneyToString(money(raw.toString()))),
  };
}

export class ProfileService {
  constructor(private readonly repo: ProfileRepository = new ProfileRepository()) {}

  async get(userId: string): Promise<ProfileDto> {
    const row = await this.repo.findByUserId(userId);
    if (!row) {
      return { userId, initialBalance: 0 };
    }
    return toDto(row);
  }

  async updateInitialBalance(
    userId: string,
    body: UpdateInitialBalanceBody,
  ): Promise<ProfileDto> {
    const saved = await this.repo.upsertInitialBalance(
      userId,
      moneyToString(money(body.initialBalance)),
    );

    await writeAuditLog({
      userId,
      action: 'update',
      entityType: 'user_profile',
      entityId: userId,
      metadata: { field: 'initial_balance' },
    });

    return toDto(saved);
  }
}
