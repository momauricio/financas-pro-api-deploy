import { writeAuditLog } from '../../shared/middlewares/audit.js';
import { ValidationError } from '../../shared/errors/index.js';
import { money, moneyToString } from '../../shared/utils/money.js';
import type { UpsertGoalBody, UpsertGoalsBatchBody } from './goal.schema.js';
import { GoalRepository, type GoalRecord } from './goal.repository.js';
import type { GoalDto, PaginatedGoals } from './goal.types.js';

function toDto(row: GoalRecord): GoalDto {
  const amountRaw = row.amount ?? 0;
  return {
    id: row.id,
    monthId: row.monthId,
    category: row.category,
    amount: Number(moneyToString(money(amountRaw.toString()))),
  };
}

export class GoalService {
  constructor(private readonly repo: GoalRepository = new GoalRepository()) {}

  async list(
    userId: string,
    query: { page: number; pageSize: number; monthId?: string },
  ): Promise<PaginatedGoals> {
    const skip = (query.page - 1) * query.pageSize;
    const { rows, total } = await this.repo.listByUser(userId, {
      skip,
      take: query.pageSize,
      monthId: query.monthId,
    });
    return {
      items: rows.map(toDto),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async upsert(userId: string, body: UpsertGoalBody): Promise<GoalDto> {
    const category = body.category.trim();
    if (!category) {
      throw new ValidationError('Goal category is required');
    }

    const saved = await this.repo.upsert({
      userId,
      monthId: body.monthId,
      category,
      amount: moneyToString(money(body.amount)),
    });

    await writeAuditLog({
      userId,
      action: 'update',
      entityType: 'goal',
      entityId: saved.id,
      metadata: { monthId: body.monthId, category },
    });

    return toDto(saved);
  }

  async upsertBatch(userId: string, body: UpsertGoalsBatchBody): Promise<GoalDto[]> {
    const normalized = body.goals.map((g) => {
      const category = g.category.trim();
      if (!category) {
        throw new ValidationError('Goal category is required');
      }
      return {
        category,
        amount: moneyToString(money(g.amount)),
      };
    });

    const saved = await this.repo.upsertMany(userId, body.monthId, normalized);

    await writeAuditLog({
      userId,
      action: 'update',
      entityType: 'goal',
      entityId: null,
      metadata: { monthId: body.monthId, count: saved.length },
    });

    return saved.map(toDto);
  }
}
