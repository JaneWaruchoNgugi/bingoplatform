import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1).max(64),
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(500).optional(),
  isActive: z.boolean().default(true),
  priceMinorUnits: z.number().int().min(1),
  currency: z.string().length(3).default('KES'),
  maxTicketsPerPurchase: z.number().int().min(1).max(100).default(10),
});

export const updateCategorySchema = createCategorySchema.partial().omit({ slug: true });

export const categoryIdSchema = z.string().uuid();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
