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
const databaseUrl = process.env.DATABASE_URL;
const shouldUseTurso =
  typeof databaseUrl === 'string' &&
  databaseUrl.length > 0 &&
  !databaseUrl.startsWith('file:') &&
  process.env.NODE_ENV !== 'test' &&
  typeof process.env.DATABASE_AUTH_TOKEN === 'string' &&
  process.env.DATABASE_AUTH_TOKEN.length > 0;

if (shouldUseTurso) {
  // Use Turso with LibSQL whenever auth token is provided
  const libsql = createClient({
    url: databaseUrl,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

  const adapter = new PrismaLibSQL(libsql);
  prisma = new PrismaClient({
    adapter,
    log: ['error'],
  });
} else {
  // Development: Use local SQLite with singleton pattern
  const dbUrl = typeof databaseUrl === 'string' && databaseUrl.startsWith('file:') ? databaseUrl : 'file:./prisma/dev.db';

  prisma = global.prisma || new PrismaClient({
    log: process.env.PRISMA_LOG_QUERIES === '1' ? ['query', 'error', 'warn'] : ['error', 'warn'],
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
