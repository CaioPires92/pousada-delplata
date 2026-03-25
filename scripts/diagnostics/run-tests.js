require('dotenv').config();
const https = require('https');

console.log('🧪 EXECUTANDO TESTES AUTOMATIZADOS\n');
console.log('='.repeat(60));

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

const results = [];

function test(name, fn) {
    testsRun++;
    try {
        fn();
        testsPassed++;
        results.push({ name, status: '✅ PASSOU', error: null });
        console.log(`✅ ${name}`);
    } catch (error) {
        testsFailed++;
        results.push({ name, status: '❌ FALHOU', error: error.message });
        console.log(`❌ ${name}: ${error.message}`);
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

// ===== TESTES DE CONFIGURAÇÃO =====
console.log('\n📋 1. TESTES DE CONFIGURAÇÃO\n');

test('1.1 - Variáveis de ambiente carregadas', () => {
    assert(process.env.DATABASE_URL, 'DATABASE_URL não configurada');
    assert(process.env.MP_ACCESS_TOKEN, 'MP_ACCESS_TOKEN não configurada');
    assert(process.env.SMTP_HOST, 'SMTP_HOST não configurada');
});

test('1.2 - Ambiente de teste detectado', () => {
    const token = process.env.MP_ACCESS_TOKEN;
    assert(token.startsWith('TEST-'), 'Não está em ambiente de teste');
});

test('1.3 - URLs configuradas corretamente', () => {
    assert(process.env.NEXT_PUBLIC_APP_URL, 'APP_URL não configurada');
    assert(process.env.NEXT_PUBLIC_APP_URL.includes('vercel.app'), 'URL inválida');
});

// ===== TESTES DE API =====
console.log('\n📋 2. TESTES DE API\n');

function testAPI(name, options, expectedStatus) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                testsRun++;
                if (res.statusCode === expectedStatus) {
                    testsPassed++;
                    results.push({ name, status: '✅ PASSOU', error: null });
                    console.log(`✅ ${name}`);
                    resolve(data);
                } else {
                    testsFailed++;
                    const error = `Status ${res.statusCode}, esperado ${expectedStatus}`;
                    results.push({ name, status: '❌ FALHOU', error });
                    console.log(`❌ ${name}: ${error}`);
                    reject(error);
                }
            });
        });
        req.on('error', (error) => {
            testsRun++;
            testsFailed++;
            results.push({ name, status: '❌ FALHOU', error: error.message });
            console.log(`❌ ${name}: ${error.message}`);
            reject(error);
        });
        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

async function runAPITests() {
    // Teste de criação de preferência MP
    await testAPI(
        '2.1 - API Mercado Pago - Criar Preferência',
        {
            hostname: 'api.mercadopago.com',
            path: '/checkout/preferences',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`
            },
            body: JSON.stringify({
                items: [{
                    title: 'Teste',
                    quantity: 1,
                    unit_price: 10.00,
                    currency_id: 'BRL'
                }]
            })
        },
        201
    ).catch(() => { });

    // Resumo final
    setTimeout(() => {
        console.log('\n' + '='.repeat(60));
        console.log('📊 RESUMO DOS TESTES\n');
        console.log(`Total de testes: ${testsRun}`);
        console.log(`✅ Passou: ${testsPassed} (${Math.round(testsPassed / testsRun * 100)}%)`);
        console.log(`❌ Falhou: ${testsFailed} (${Math.round(testsFailed / testsRun * 100)}%)`);
        console.log('='.repeat(60));

        if (testsFailed > 0) {
            console.log('\n❌ TESTES COM FALHA:\n');
            results.filter(r => r.status.includes('❌')).forEach(r => {
                console.log(`- ${r.name}: ${r.error}`);
            });
        }

        console.log('\n✅ Testes concluídos!');
        console.log('📄 Veja o relatório completo em: docs/root-legacy/PLANO_QA_TESTES.md\n');
    }, 2000);
}

runAPITests();
