import { writeAuditLog } from '../../shared/middlewares/audit.js';
import { NotFoundError, ValidationError } from '../../shared/errors/index.js';
import type { CreateCategoryBody, UpdateCategoryBody } from './category.schema.js';
import { CategoryRepository, type CategoryRecord } from './category.repository.js';
import type { CategoryDto, PaginatedCategories } from './category.types.js';

function toDto(row: CategoryRecord): CategoryDto {
  return {
    id: row.id,
    name: row.name,
    type: row.type as 'income' | 'expense',
    color: row.color ?? '#4f46e5',
    active: row.active ?? true,
  };
}

export class CategoryService {
  constructor(private readonly repo: CategoryRepository = new CategoryRepository()) {}

  async list(
    userId: string,
    query: { page: number; pageSize: number; active?: boolean },
  ): Promise<PaginatedCategories> {
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

  async create(userId: string, body: CreateCategoryBody): Promise<CategoryDto> {
    const name = body.name.trim();
    if (!name) {
      throw new ValidationError('Category name is required');
    }
    const created = await this.repo.create({
      userId,
      name,
      type: body.type,
      color: body.color,
      active: body.active,
    });
    await writeAuditLog({
      userId,
      action: 'create',
      entityType: 'category',
      entityId: created.id,
      metadata: { type: body.type, active: body.active },
    });
    return toDto(created);
  }

  async update(userId: string, id: string, body: UpdateCategoryBody): Promise<CategoryDto> {
    const current = await this.repo.findByIdForUser(id, userId);
    if (!current) {
      throw new NotFoundError('Category not found');
    }

    const nextName = body.name?.trim();
    const nameChanged =
      nextName != null && nextName !== '' && nextName !== current.name;

    const otherUpdates: Partial<{ type: string; color: string; active: boolean }> = {};
    if (body.type !== undefined) otherUpdates.type = body.type;
    if (body.color !== undefined) otherUpdates.color = body.color;
    if (body.active !== undefined) otherUpdates.active = body.active;

    let updated: CategoryRecord;
    if (nameChanged && nextName) {
      updated = await this.repo.renameWithCascade({
        id,
        userId,
        oldName: current.name,
        nextName,
        otherUpdates,
      });
    } else {
      updated = await this.repo.update(id, userId, {
        ...otherUpdates,
        ...(nextName ? { name: nextName } : {}),
      });
    }

    await writeAuditLog({
      userId,
      action: 'update',
      entityType: 'category',
      entityId: id,
      metadata: { renamed: nameChanged },
    });
    return toDto(updated);
  }

  async delete(userId: string, id: string): Promise<void> {
    const current = await this.repo.findByIdForUser(id, userId);
    if (!current) {
      throw new NotFoundError('Category not found');
    }
    const ok = await this.repo.delete(id, userId);
    if (!ok) {
      throw new NotFoundError('Category not found');
    }
    await writeAuditLog({
      userId,
      action: 'delete',
      entityType: 'category',
      entityId: id,
      metadata: null,
    });
  }
}
