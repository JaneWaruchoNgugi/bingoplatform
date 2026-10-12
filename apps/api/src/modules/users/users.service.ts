import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';
import { Prisma, type User, UserStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type { CreateUserInput, PaginationInput } from './users.schema';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString('hex')}`;
}

export interface UserResponse {
  id: string;
  username: string;
  email: string | null;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface PagedUsers {
  users: UserResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function formatUser(user: User): UserResponse {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function listUsers(pagination: PaginationInput): Promise<PagedUsers> {
  const { page, limit } = pagination;
  const skip = (page - 1) * limit;

  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.user.count(),
  ]);

  return {
    users: users.map(formatUser),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getUserById(id: string): Promise<UserResponse | null> {
  const user = await prisma.user.findUnique({ where: { id } });
  return user ? formatUser(user) : null;
}

export interface CreateUserResult {
  user: UserResponse;
}

export type CreateUserError = { type: 'duplicate'; field: 'username' | 'email' };

export async function createUser(
  input: CreateUserInput,
): Promise<CreateUserResult | CreateUserError> {
  const passwordHash = input.password ? await hashPassword(input.password) : null;
  try {
    const user = await prisma.user.create({
      data: {
        username: input.username,
        email: input.email ?? null,
        passwordHash,
      },
    });
    return { user: formatUser(user) };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      const target = (err.meta?.target as string[]) ?? [];
      const field = target.includes('email') ? 'email' : 'username';
      return { type: 'duplicate', field };
    }
    throw err;
  }
}
