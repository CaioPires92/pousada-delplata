require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaLibSQL } = require('@prisma/adapter-libsql');
const { createClient } = require('@libsql/client');

console.log('🧪 TESTES DE DATABASE E INTEGRIDADE\n');
console.log('='.repeat(60));

let prisma;

if (process.env.DATABASE_AUTH_TOKEN) {
    const libsql = createClient({
        url: process.env.DATABASE_URL,
        authToken: process.env.DATABASE_AUTH_TOKEN,
    });
    const adapter = new PrismaLibSQL(libsql);
    prisma = new PrismaClient({ adapter });
} else {
    prisma = new PrismaClient();
}

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

async function test(name, fn) {
    testsRun++;
    try {
        await fn();
        testsPassed++;
        console.log(`✅ ${name}`);
    } catch (error) {
        testsFailed++;
        console.log(`❌ ${name}: ${error.message}`);
    }
}

async function runTests() {
    console.log('\n📋 1. TESTES DE CONEXÃO\n');

    await test('1.1 - Conectar ao banco de dados', async () => {
        await prisma.$connect();
    });

    await test('1.2 - Executar query simples', async () => {
        const count = await prisma.roomType.count();
        if (count === 0) throw new Error('Nenhum quarto encontrado - rode o seed');
    });

    console.log('\n📋 2. TESTES DE SCHEMA\n');

    await test('2.1 - Tabela RoomType existe e tem dados', async () => {
        const rooms = await prisma.roomType.findMany();
        if (rooms.length === 0) throw new Error('Sem dados de quartos');
        if (!rooms[0].name) throw new Error('Campo name ausente');
        if (!rooms[0].basePrice) throw new Error('Campo basePrice ausente');
    });

    await test('2.2 - Tabela Booking existe', async () => {
        const bookings = await prisma.booking.findMany({ take: 1 });
        // OK se retornar vazio ou com dados
    });

    await test('2.3 - Tabela Payment existe', async () => {
        const payments = await prisma.payment.findMany({ take: 1 });
        // OK se retornar vazio ou com dados
    });

    await test('2.4 - Tabela Guest existe', async () => {
        const guests = await prisma.guest.findMany({ take: 1 });
        // OK se retornar vazio ou com dados
    });

    await test('2.5 - Tabela AdminUser existe e tem admin', async () => {
        const admin = await prisma.adminUser.findFirst();
        if (!admin) throw new Error('Nenhum admin encontrado - rode o seed');
        if (!admin.email) throw new Error('Email do admin ausente');
    });

    console.log('\n📋 3. TESTES DE RELACIONAMENTOS\n');

    await test('3.1 - RoomType → Photos (1:N)', async () => {
        const room = await prisma.roomType.findFirst({
            include: { photos: true }
        });
        if (!room) throw new Error('Nenhum quarto encontrado');
        // OK se tem ou não fotos
    });

    await test('3.2 - Booking → Guest (N:1)', async () => {
        const booking = await prisma.booking.findFirst({
            include: { guest: true }
        });
        // OK se não tem bookings ainda
        if (booking && !booking.guest) {
            throw new Error('Booking sem guest associado');
        }
    });

    await test('3.3 - Booking → RoomType (N:1)', async () => {
        const booking = await prisma.booking.findFirst({
            include: { roomType: true }
        });
        // OK se não tem bookings ainda
        if (booking && !booking.roomType) {
            throw new Error('Booking sem roomType associado');
        }
    });

    await test('3.4 - Booking → Payment (1:N)', async () => {
        const booking = await prisma.booking.findFirst({
            include: { payment: true }
        });
        // OK se não tem bookings ainda
    });

    console.log('\n📋 4. TESTES DE VALIDAÇÃO DE DADOS\n');

    await test('4.1 - Preços dos quartos são válidos', async () => {
        const rooms = await prisma.roomType.findMany();
        rooms.forEach(room => {
            if (room.basePrice <= 0) {
                throw new Error(`Quarto ${room.name} tem preço inválido: ${room.basePrice}`);
            }
        });
    });

    await test('4.2 - Capacidade dos quartos é válida', async () => {
        const rooms = await prisma.roomType.findMany();
        rooms.forEach(room => {
            if (room.capacity <= 0) {
                throw new Error(`Quarto ${room.name} tem capacidade inválida: ${room.capacity}`);
            }
        });
    });

    await test('4.3 - Total de unidades é válido', async () => {
        const rooms = await prisma.roomType.findMany();
        rooms.forEach(room => {
            if (room.totalUnits <= 0) {
                throw new Error(`Quarto ${room.name} tem totalUnits inválido: ${room.totalUnits}`);
            }
        });
    });

    console.log('\n📋 5. TESTES DE PERFORMANCE\n');

    await test('5.1 - Query de quartos < 100ms', async () => {
        const start = Date.now();
        await prisma.roomType.findMany();
        const duration = Date.now() - start;
        if (duration > 100) {
            throw new Error(`Query demorou ${duration}ms (limite: 100ms)`);
        }
    });

    await test('5.2 - Query com joins < 200ms', async () => {
        const start = Date.now();
        await prisma.booking.findMany({
            include: {
                guest: true,
                roomType: true,
                payment: true
            },
            take: 10
        });
        const duration = Date.now() - start;
        if (duration > 200) {
            throw new Error(`Query demorou ${duration}ms (limite: 200ms)`);
        }
    });

    console.log('\n📋 6. TESTES DE INTEGRIDADE\n');

    await test('6.1 - Não há quartos duplicados', async () => {
        const rooms = await prisma.roomType.findMany();
        const names = rooms.map(r => r.name);
        const uniqueNames = new Set(names);
        if (names.length !== uniqueNames.size) {
            throw new Error('Existem quartos com nomes duplicados');
        }
    });

    await test('6.2 - Todos os quartos têm descrição', async () => {
        const rooms = await prisma.roomType.findMany();
        rooms.forEach(room => {
            if (!room.description || room.description.trim() === '') {
                throw new Error(`Quarto ${room.name} sem descrição`);
            }
        });
    });

    await test('6.3 - Todos os quartos têm amenidades', async () => {
        const rooms = await prisma.roomType.findMany();
        rooms.forEach(room => {
            if (!room.amenities || room.amenities.trim() === '') {
                throw new Error(`Quarto ${room.name} sem amenidades`);
            }
        });
    });

    // Resumo
    await prisma.$disconnect();

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMO DOS TESTES DE DATABASE\n');
    console.log(`Total de testes: ${testsRun}`);
    console.log(`✅ Passou: ${testsPassed} (${Math.round(testsPassed / testsRun * 100)}%)`);
    console.log(`❌ Falhou: ${testsFailed} (${Math.round(testsFailed / testsRun * 100)}%)`);
    console.log('='.repeat(60));

    if (testsFailed === 0) {
        console.log('\n🎉 TODOS OS TESTES PASSARAM!\n');
    } else {
        console.log('\n⚠️  ALGUNS TESTES FALHARAM - Verifique os erros acima\n');
    }

    process.exit(testsFailed > 0 ? 1 : 0);
}

runTests().catch(error => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
});
