import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

declare global {
  var prisma: PrismaClient | undefined;
}

let prisma: PrismaClient;

// Check if we're using Turso (DATABASE_AUTH_TOKEN is only needed for Turso)
if (process.env.DATABASE_AUTH_TOKEN) {
  // Production: Use Turso with LibSQL
  const libsql = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

  const adapter = new PrismaLibSQL(libsql);
  prisma = new PrismaClient({ adapter });
} else {
  // Development: Use local SQLite
  prisma = global.prisma || new PrismaClient();

  if (process.env.NODE_ENV !== 'production') {
    global.prisma = prisma;
  }
}

export default prisma;
