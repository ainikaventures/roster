import { PrismaClient } from '@prisma/client';

// Prevent multiple Prisma clients in dev/hot-reload (Next.js).
declare global {
  // eslint-disable-next-line no-var
  var __rosterPrisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__rosterPrisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__rosterPrisma = prisma;
}
