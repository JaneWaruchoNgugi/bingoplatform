import { prisma } from './prisma';
import { logger } from './logger';

export interface AuditParams {
  actorId: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  roundId?: string;
  metadata?: Record<string, unknown>;
}

export async function recordAudit(params: AuditParams): Promise<void> {
  try {
    await prisma.bingoAuditEvent.create({
      data: {
        actorId: params.actorId,
        actorRole: params.actorRole,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        roundId: params.roundId,
        metadata: params.metadata as object | undefined,
      },
    });
  } catch (err) {
    logger.error({ err, params }, 'Failed to write audit event');
  }
}
