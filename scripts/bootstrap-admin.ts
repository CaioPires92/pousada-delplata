import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';

function getArgValue(name: string): string | undefined {
    const prefix = `--${name}=`;
    const inline = process.argv.find((a) => a.startsWith(prefix));
    if (inline) return inline.slice(prefix.length);

    const idx = process.argv.indexOf(`--${name}`);
    if (idx >= 0) return process.argv[idx + 1];

    return undefined;
}

async function main() {
    const expectedSecret = process.env.ADMIN_BOOTSTRAP_SECRET;
    const providedSecret = getArgValue('secret');

    if (!expectedSecret || !providedSecret || providedSecret !== expectedSecret) {
        console.error('Unauthorized');
        process.exit(1);
    }

    const emailInput = getArgValue('email') ?? process.env.SEED_ADMIN_EMAIL;
    const passwordInput = getArgValue('password') ?? process.env.SEED_ADMIN_PASSWORD;

    if (!emailInput || !passwordInput) {
        console.error('Missing email/password');
        process.exit(1);
    }

    const email = emailInput.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(passwordInput, 10);

    let prisma: PrismaClient;

    if (process.env.DATABASE_AUTH_TOKEN) {
        const libsql = createClient({
            url: process.env.DATABASE_URL!,
            authToken: process.env.DATABASE_AUTH_TOKEN,
        });

        const adapter = new PrismaLibSQL(libsql);
        prisma = new PrismaClient({ adapter });
    } else {
        prisma = new PrismaClient();
    }

    try {
        await prisma.adminUser.upsert({
            where: { email },
            update: { passwordHash, isActive: true },
            create: { email, passwordHash, isActive: true },
        });
        console.log('OK');
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((err) => {
    console.error('Error');
    console.error(err);
    process.exit(1);
});
