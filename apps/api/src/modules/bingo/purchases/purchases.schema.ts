import { z } from 'zod';

export const purchaseIdSchema = z.string().uuid();
export const ticketIdSchema = z.string().uuid();

export const createPurchaseSchema = z.object({
  ticketCount: z.number().int().min(1).max(100),
  idempotencyKey: z.string().min(8).max(128),
});

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
