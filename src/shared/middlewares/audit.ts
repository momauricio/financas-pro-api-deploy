import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';

type AuditInput = {
  userId: string;
  action: 'create' | 'update' | 'delete';
  entityType: string;
  entityId?: string | null;
  /** Must not include raw money amounts or secrets. */
  metadata?: Record<string, unknown> | null;
};

export async function writeAuditLog(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metadata:
          input.metadata === null || input.metadata === undefined
            ? undefined
            : (input.metadata as Prisma.InputJsonValue),
      },
    });
  } catch (err) {
    // Audit must not break the main mutation; log and continue.
    console.error('audit_log_write_failed', err instanceof Error ? err.message : 'unknown');
  }
}
