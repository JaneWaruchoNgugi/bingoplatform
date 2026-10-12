import { z } from 'zod';
import { RoundStatus } from '@prisma/client';

export const roundIdSchema = z.string().uuid();

export const listRoundsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(RoundStatus).optional(),
  categoryId: z.string().uuid().optional(),
});

export const createRoundSchema = z.object({
  categoryId: z.string().uuid(),
  scheduledStart: z.string().datetime(),
  salesDeadline: z.string().datetime(),
  maxTickets: z.number().int().min(1).optional(),
  prizeRules: z
    .array(
      z.object({
        name: z.string().min(1).max(64),
        pattern: z.record(z.unknown()),
        prizeMinorUnits: z.number().int().min(0).optional(),
        prizePercentage: z.number().min(0).max(100).optional(),
        callLimit: z.number().int().min(1).max(75).optional(),
        priority: z.number().int().default(0),
      }),
    )
    .optional(),
});

export const updateRoundSchema = z.object({
  scheduledStart: z.string().datetime().optional(),
  salesDeadline: z.string().datetime().optional(),
  maxTickets: z.number().int().min(1).optional(),
});

export const cancelRoundSchema = z.object({
  reason: z.string().min(1).max(500),
});

export type ListRoundsInput = z.infer<typeof listRoundsSchema>;
export type CreateRoundInput = z.infer<typeof createRoundSchema>;
export type UpdateRoundInput = z.infer<typeof updateRoundSchema>;
export type CancelRoundInput = z.infer<typeof cancelRoundSchema>;
