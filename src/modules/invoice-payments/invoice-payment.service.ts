import { writeAuditLog } from '../../shared/middlewares/audit.js';
import { NotFoundError, ValidationError } from '../../shared/errors/index.js';
import { CreditCardRepository } from '../credit-cards/credit-card.repository.js';
import type { UpsertInvoicePaymentBody } from './invoice-payment.schema.js';
import {
  InvoicePaymentRepository,
  type InvoicePaymentRecord,
} from './invoice-payment.repository.js';
import type { InvoicePaymentDto, PaginatedInvoicePayments } from './invoice-payment.types.js';

function toDto(row: InvoicePaymentRecord): InvoicePaymentDto {
  if (!row.cardId) {
    throw new ValidationError('Invoice payment missing cardId');
  }
  return {
    id: row.id,
    monthId: row.monthId,
    cardId: row.cardId,
    isPaid: row.isPaid ?? false,
  };
}

export class InvoicePaymentService {
  constructor(
    private readonly repo: InvoicePaymentRepository = new InvoicePaymentRepository(),
    private readonly cards: CreditCardRepository = new CreditCardRepository(),
  ) {}

  async list(
    userId: string,
    query: { page: number; pageSize: number; monthId?: string; cardId?: string },
  ): Promise<PaginatedInvoicePayments> {
    const skip = (query.page - 1) * query.pageSize;
    const { rows, total } = await this.repo.listByUser(userId, {
      skip,
      take: query.pageSize,
      monthId: query.monthId,
      cardId: query.cardId,
    });
    return {
      items: rows.map(toDto),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async upsert(userId: string, body: UpsertInvoicePaymentBody): Promise<InvoicePaymentDto> {
    const card = await this.cards.findByIdForUser(body.cardId, userId);
    if (!card) {
      throw new NotFoundError('Credit card not found');
    }

    const saved = await this.repo.upsert({
      userId,
      monthId: body.monthId,
      cardId: body.cardId,
      isPaid: body.isPaid,
    });

    await writeAuditLog({
      userId,
      action: 'update',
      entityType: 'invoice_payment',
      entityId: saved.id,
      metadata: { monthId: body.monthId, cardId: body.cardId, isPaid: body.isPaid },
    });

    return toDto(saved);
  }
}
