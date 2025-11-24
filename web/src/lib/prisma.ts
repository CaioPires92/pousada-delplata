import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';

declare global {
  var prisma: PrismaClient | undefined;
}

let prisma: PrismaClient;

/**
 * Initialize Prisma client with Turso adapter in production
 * or local SQLite in development
 */
if (process.env.DATABASE_AUTH_TOKEN) {
  // Production: Use Turso with LibSQL
  const libsql = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

  const adapter = new PrismaLibSQL(libsql);
  prisma = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
} else {
  // Development: Use local SQLite with singleton pattern
  const dbUrl = process.env.DATABASE_URL || 'file:./dev.db';
  console.log(`[Prisma] Initializing in DEVELOPMENT mode`);
  console.log(`[Prisma] Database URL: ${dbUrl}`);

  prisma = global.prisma || new PrismaClient({
    log: ['query', 'error', 'warn'],
    datasources: {
      db: {
        url: dbUrl,
      },
    },
  });

  if (process.env.NODE_ENV !== 'production') {
    global.prisma = prisma;
  }
}

export default prisma;
