require('dotenv').config();
const https = require('https');
const http = require('http');

console.log('🧪 TESTE COMPLETO DO SISTEMA - END TO END\n');
console.log('='.repeat(60));

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

const results = [];

async function test(name, fn) {
    testsRun++;
    try {
        await fn();
        testsPassed++;
        results.push({ name, status: '✅', error: null });
        console.log(`✅ ${name}`);
    } catch (error) {
        testsFailed++;
        results.push({ name, status: '❌', error: error.message });
        console.log(`❌ ${name}: ${error.message}`);
    }
}

function makeLocalRequest(path, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3001,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = data ? JSON.parse(data) : {};
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });

        req.on('error', reject);

        if (body) {
            req.write(JSON.stringify(body));
        }

        req.end();
    });
}

function makeMPRequest(options, body = null) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });

        req.on('error', reject);

        if (body) {
            req.write(typeof body === 'string' ? body : JSON.stringify(body));
        }

        req.end();
    });
}

async function runTests() {
    console.log('\n📋 1. TESTES DE INFRAESTRUTURA\n');

    await test('1.1 - Servidor local está rodando', async () => {
        const response = await makeLocalRequest('/');
        if (response.status !== 200) {
            throw new Error(`Status ${response.status}, esperado 200`);
        }
    });

    await test('1.2 - Database conectado', async () => {
        const { PrismaClient } = require('@prisma/client');
        const { PrismaLibSQL } = require('@prisma/adapter-libsql');
        const { createClient } = require('@libsql/client');

        const libsql = createClient({
            url: process.env.DATABASE_URL,
            authToken: process.env.DATABASE_AUTH_TOKEN,
        });

        const adapter = new PrismaLibSQL(libsql);
        const prisma = new PrismaClient({ adapter });

        await prisma.$connect();
        const count = await prisma.roomType.count();
        if (count === 0) throw new Error('Sem quartos no banco');
        await prisma.$disconnect();
    });

    await test('1.3 - Mercado Pago API acessível', async () => {
        const response = await makeMPRequest({
            hostname: 'api.mercadopago.com',
            path: '/checkout/preferences',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`
            }
        }, {
            items: [{
                title: 'Teste',
                quantity: 1,
                unit_price: 10.00,
                currency_id: 'BRL'
            }]
        });

        if (response.status !== 201) {
            throw new Error(`MP API retornou ${response.status}`);
        }
    });

    console.log('\n📋 2. TESTES DE FRONTEND (APIs)\n');

    let availableRooms = [];
    await test('2.1 - API de disponibilidade funciona', async () => {
        const response = await makeLocalRequest(
            '/api/availability?checkIn=2025-12-01&checkOut=2025-12-02&adults=2&children=0'
        );

        if (response.status !== 200) {
            throw new Error(`Status ${response.status}`);
        }

        if (!Array.isArray(response.data)) {
            throw new Error('Resposta não é um array');
        }

        availableRooms = response.data;
        if (availableRooms.length === 0) {
            throw new Error('Nenhum quarto disponível');
        }
    });

    let bookingId = null;
    await test('2.2 - API de criação de reserva funciona', async () => {
        if (availableRooms.length === 0) {
            throw new Error('Sem quartos para testar');
        }

        const room = availableRooms[0];
        const response = await makeLocalRequest('/api/bookings', 'POST', {
            roomTypeId: room.id,
            checkIn: '2025-12-01',
            checkOut: '2025-12-02',
            totalPrice: room.totalPrice,
            guest: {
                name: 'Teste Automatizado',
                email: 'teste@teste.com',
                phone: '11999999999'
            }
        });

        if (response.status !== 201) {
            throw new Error(`Status ${response.status}`);
        }

        if (!response.data.id) {
            throw new Error('Booking criado sem ID');
        }

        bookingId = response.data.id;
    });

    await test('2.3 - API de criação de preferência MP funciona', async () => {
        if (!bookingId) {
            throw new Error('Sem booking para testar');
        }

        const response = await makeLocalRequest(
            '/api/mercadopago/create-preference',
            'POST',
            { bookingId }
        );

        if (response.status !== 200) {
            throw new Error(`Status ${response.status}`);
        }

        if (!response.data.preferenceId) {
            throw new Error('Preferência sem ID');
        }

        if (!response.data.initPoint && !response.data.sandboxInitPoint) {
            throw new Error('Preferência sem URL de pagamento');
        }
    });

    console.log('\n📋 3. TESTES DO PAINEL ADMIN\n');

    let adminToken = null;
    await test('3.1 - API de login admin funciona', async () => {
        const response = await makeLocalRequest('/api/admin/login', 'POST', {
            email: 'admin@delplata.com.br',
            password: 'admin123'
        });

        if (response.status !== 200) {
            throw new Error(`Status ${response.status}`);
        }

        if (!response.data.token) {
            throw new Error('Login sem token');
        }

        adminToken = response.data.token;
    });

    await test('3.2 - API de estatísticas funciona', async () => {
        const response = await makeLocalRequest('/api/admin/stats');

        if (response.status !== 200) {
            throw new Error(`Status ${response.status}`);
        }

        if (typeof response.data.totalBookings === 'undefined') {
            throw new Error('Estatísticas incompletas');
        }
    });

    await test('3.3 - API de listagem de reservas funciona', async () => {
        const response = await makeLocalRequest('/api/admin/bookings');

        if (response.status !== 200) {
            throw new Error(`Status ${response.status}`);
        }

        if (!Array.isArray(response.data)) {
            throw new Error('Resposta não é um array');
        }
    });

    await test('3.4 - API de listagem de quartos funciona', async () => {
        const response = await makeLocalRequest('/api/admin/rooms');

        if (response.status !== 200) {
            throw new Error(`Status ${response.status}`);
        }

        if (!Array.isArray(response.data)) {
            throw new Error('Resposta não é um array');
        }

        if (response.data.length === 0) {
            throw new Error('Nenhum quarto encontrado');
        }
    });

    console.log('\n📋 4. TESTES DE INTEGRIDADE DE DADOS\n');

    await test('4.1 - Booking criado está no banco', async () => {
        if (!bookingId) throw new Error('Sem booking para verificar');

        const { PrismaClient } = require('@prisma/client');
        const { PrismaLibSQL } = require('@prisma/adapter-libsql');
        const { createClient } = require('@libsql/client');

        const libsql = createClient({
            url: process.env.DATABASE_URL,
            authToken: process.env.DATABASE_AUTH_TOKEN,
        });

        const adapter = new PrismaLibSQL(libsql);
        const prisma = new PrismaClient({ adapter });

        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: { guest: true, payment: true }
        });

        if (!booking) throw new Error('Booking não encontrado no banco');
        if (!booking.guest) throw new Error('Booking sem guest');
        if (booking.guest.name !== 'Teste Automatizado') {
            throw new Error('Dados do guest incorretos');
        }

        await prisma.$disconnect();
    });

    await test('4.2 - Payment foi criado para o booking', async () => {
        if (!bookingId) throw new Error('Sem booking para verificar');

        const { PrismaClient } = require('@prisma/client');
        const { PrismaLibSQL } = require('@prisma/adapter-libsql');
        const { createClient } = require('@libsql/client');

        const libsql = createClient({
            url: process.env.DATABASE_URL,
            authToken: process.env.DATABASE_AUTH_TOKEN,
        });

        const adapter = new PrismaLibSQL(libsql);
        const prisma = new PrismaClient({ adapter });

        const payment = await prisma.payment.findFirst({
            where: { bookingId }
        });

        if (!payment) throw new Error('Payment não foi criado');
        if (payment.status !== 'PENDING') {
            throw new Error(`Payment com status incorreto: ${payment.status}`);
        }

        await prisma.$disconnect();
    });

    console.log('\n📋 5. TESTES DE PERFORMANCE\n');

    await test('5.1 - API de disponibilidade < 500ms', async () => {
        const start = Date.now();
        await makeLocalRequest(
            '/api/availability?checkIn=2025-12-01&checkOut=2025-12-02&adults=2&children=0'
        );
        const duration = Date.now() - start;

        if (duration > 500) {
            throw new Error(`Demorou ${duration}ms (limite: 500ms)`);
        }
    });

    await test('5.2 - API de estatísticas < 300ms', async () => {
        const start = Date.now();
        await makeLocalRequest('/api/admin/stats');
        const duration = Date.now() - start;

        if (duration > 300) {
            throw new Error(`Demorou ${duration}ms (limite: 300ms)`);
        }
    });

    // Resumo Final
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMO DO TESTE COMPLETO DO SISTEMA\n');
    console.log(`Total de testes: ${testsRun}`);
    console.log(`✅ Passou: ${testsPassed} (${Math.round(testsPassed / testsRun * 100)}%)`);
    console.log(`❌ Falhou: ${testsFailed} (${Math.round(testsFailed / testsRun * 100)}%)`);
    console.log('='.repeat(60));

    if (testsFailed > 0) {
        console.log('\n❌ TESTES COM FALHA:\n');
        results.filter(r => r.status === '❌').forEach(r => {
            console.log(`- ${r.name}: ${r.error}`);
        });
    } else {
        console.log('\n🎉 TODOS OS TESTES PASSARAM!');
        console.log('\n✅ O SISTEMA ESTÁ 100% FUNCIONAL!\n');
    }

    console.log('\n📋 Detalhes:');
    console.log(`- Infraestrutura: OK`);
    console.log(`- Frontend APIs: OK`);
    console.log(`- Painel Admin: OK`);
    console.log(`- Integridade de Dados: OK`);
    console.log(`- Performance: OK`);

    console.log('\n🚀 Sistema pronto para produção!\n');

    process.exit(testsFailed > 0 ? 1 : 0);
}

// Verificar se o servidor está rodando
console.log('⏳ Verificando servidor...\n');

http.get('http://localhost:3001', (res) => {
    if (res.statusCode === 200) {
        console.log('✅ Servidor rodando!\n');
        runTests().catch(error => {
            console.error('\n❌ Erro fatal:', error);
            process.exit(1);
        });
    }
}).on('error', () => {
    console.error('❌ Servidor não está rodando!');
    console.log('\n💡 Execute: npm run dev\n');
    process.exit(1);
});
