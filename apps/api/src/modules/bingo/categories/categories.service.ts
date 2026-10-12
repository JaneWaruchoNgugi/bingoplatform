import { Prisma } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import { ConflictError, NotFoundError } from '../../../lib/errors';
import type { CreateCategoryInput, UpdateCategoryInput } from './categories.schema';

export async function listCategories(activeOnly = true, page = 1, limit = 100) {
  const skip = (page - 1) * limit;
  const where = activeOnly ? { isActive: true } : undefined;
  const [categories, total] = await prisma.$transaction([
    prisma.bingoCategory.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
    prisma.bingoCategory.count({ where }),
  ]);
  return { categories, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getCategoryById(id: string) {
  const cat = await prisma.bingoCategory.findUnique({ where: { id } });
  if (!cat) throw new NotFoundError('Category');
  return cat;
}

export async function getCategoryRounds(categoryId: string, page: number, limit: number) {
  await getCategoryById(categoryId);
  const skip = (page - 1) * limit;
  const [rounds, total] = await prisma.$transaction([
    prisma.bingoRound.findMany({
      where: { categoryId },
      skip,
      take: limit,
      orderBy: { scheduledStart: 'desc' },
    }),
    prisma.bingoRound.count({ where: { categoryId } }),
  ]);
  return { rounds, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function createCategory(input: CreateCategoryInput) {
  try {
    return await prisma.bingoCategory.create({ data: input });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('Category name or slug already exists');
    }
    throw err;
  }
}

export async function updateCategory(id: string, input: UpdateCategoryInput) {
  await getCategoryById(id);
  return prisma.bingoCategory.update({ where: { id }, data: input });
}
