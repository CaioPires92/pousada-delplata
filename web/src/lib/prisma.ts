import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

declare global {
  var prisma: PrismaClient | undefined;
}

let prisma: PrismaClient;

// Check if we're using Turso (DATABASE_AUTH_TOKEN is only needed for Turso)
if (process.env.DATABASE_AUTH_TOKEN) {
  // Production: Use Turso with LibSQL
  const adapter = new PrismaLibSql({
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

  prisma = new PrismaClient({ adapter });
} else {
  // Development: Use local SQLite
  prisma = global.prisma || new PrismaClient();

  if (process.env.NODE_ENV !== 'production') {
    global.prisma = prisma;
  }
}

export default prisma;
