import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

// Configuração para evitar múltiplas instâncias do Prisma em desenvolvimento (Hot Reload)
declare global {
  var prisma: PrismaClient | undefined;
}

let prisma: PrismaClient;

const databaseUrl = process.env.DATABASE_URL || '';
const authToken = process.env.DATABASE_AUTH_TOKEN || '';

// Verifica se a ligação é para o Turso (protocolo libsql:// ou sxtlo://)
const isTurso = databaseUrl.startsWith('libsql:') || databaseUrl.startsWith('wss:');

if (isTurso) {
  // Configuração para o Turso usando o Driver Adapter
  const libsql = createClient({
    url: databaseUrl,
    authToken: authToken,
  });

  const adapter = new PrismaLibSQL(libsql);

  prisma = new PrismaClient({
    adapter,
    log: ['error'],
  });
} else {
  // Configuração para SQLite Local (usado se a URL for file: ou estiver vazia)
  prisma = global.prisma || new PrismaClient({
    log: ['error'],
  });
}

// Em ambiente de desenvolvimento, guarda a instância no objeto global
if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export default prisma;