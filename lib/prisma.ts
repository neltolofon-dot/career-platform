import { PrismaClient } from '@prisma/client'

/**
 * Singleton. En développement, le hot reload recrée les modules à chaque
 * sauvegarde : sans ce cache global, on ouvrirait une nouvelle connexion
 * à chaque rechargement jusqu'à épuiser le pool Neon.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
