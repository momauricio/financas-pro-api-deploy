import { writeAuditLog } from '../../shared/middlewares/audit.js';
import { NotFoundError, ValidationError } from '../../shared/errors/index.js';
import { money, moneyToString } from '../../shared/utils/money.js';
import type { CreateCreditCardBody, UpdateCreditCardBody } from './credit-card.schema.js';
import { CreditCardRepository, type CreditCardRecord } from './credit-card.repository.js';
import type { CreditCardDto, PaginatedCreditCards } from './credit-card.types.js';

function toDto(row: CreditCardRecord): CreditCardDto {
  const limitRaw = row.creditLimit ?? 0;
  return {
    id: row.id,
    name: row.name,
    brand: row.brand ?? null,
    limit: Number(moneyToString(money(limitRaw.toString()))),
    closingDay: row.closingDay,
    dueDay: row.dueDay,
    active: row.active ?? true,
  };
}

export class CreditCardService {
  constructor(private readonly repo: CreditCardRepository = new CreditCardRepository()) {}

  async list(
    userId: string,
    query: { page: number; pageSize: number; active?: boolean },
  ): Promise<PaginatedCreditCards> {
    const skip = (query.page - 1) * query.pageSize;
    const { rows, total } = await this.repo.listByUser(userId, {
      skip,
      take: query.pageSize,
      active: query.active,
    });
    return {
      items: rows.map(toDto),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async create(userId: string, body: CreateCreditCardBody): Promise<CreditCardDto> {
    const name = body.name.trim();
    if (!name) {
      throw new ValidationError('Credit card name is required');
    }
    const created = await this.repo.create({
      userId,
      name,
      brand: body.brand ?? null,
      creditLimit: moneyToString(money(body.limit)),
      closingDay: body.closingDay,
      dueDay: body.dueDay,
      active: body.active,
    });
    await writeAuditLog({
      userId,
      action: 'create',
      entityType: 'credit_card',
      entityId: created.id,
      metadata: { active: body.active, closingDay: body.closingDay, dueDay: body.dueDay },
    });
    return toDto(created);
  }

  async update(userId: string, id: string, body: UpdateCreditCardBody): Promise<CreditCardDto> {
    const current = await this.repo.findByIdForUser(id, userId);
    if (!current) {
      throw new NotFoundError('Credit card not found');
    }

    const data: Partial<{
      name: string;
      brand: string | null;
      creditLimit: string;
      closingDay: number;
      dueDay: number;
      active: boolean;
    }> = {};

    if (body.name !== undefined) {
      const next = body.name.trim();
      if (!next) {
        throw new ValidationError('Credit card name is required');
      }
      data.name = next;
    }
    if (body.brand !== undefined) data.brand = body.brand;
    if (body.limit !== undefined) data.creditLimit = moneyToString(money(body.limit));
    if (body.closingDay !== undefined) data.closingDay = body.closingDay;
    if (body.dueDay !== undefined) data.dueDay = body.dueDay;
    if (body.active !== undefined) data.active = body.active;

    const updated = await this.repo.update(id, userId, data);
    await writeAuditLog({
      userId,
      action: 'update',
      entityType: 'credit_card',
      entityId: id,
      metadata: { fields: Object.keys(data) },
    });
    return toDto(updated);
  }

  async delete(userId: string, id: string): Promise<void> {
    const current = await this.repo.findByIdForUser(id, userId);
    if (!current) {
      throw new NotFoundError('Credit card not found');
    }
    const ok = await this.repo.delete(id, userId);
    if (!ok) {
      throw new NotFoundError('Credit card not found');
    }
    await writeAuditLog({
      userId,
      action: 'delete',
      entityType: 'credit_card',
      entityId: id,
      metadata: null,
    });
  }
}
