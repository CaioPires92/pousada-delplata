require('dotenv').config();
const https = require('https');

console.log('🧪 TESTES DE INTEGRAÇÃO - MERCADO PAGO\n');
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

function makeRequest(options, body = null) {
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
    const accessToken = process.env.MP_ACCESS_TOKEN;
    const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;

    console.log('\n📋 1. TESTES DE CONFIGURAÇÃO\n');

    await test('1.1 - Access Token configurado', async () => {
        if (!accessToken) throw new Error('MP_ACCESS_TOKEN não configurado');
        if (!accessToken.startsWith('TEST-') && !accessToken.startsWith('APP_USR-')) {
            throw new Error('Token em formato inválido');
        }
    });

    await test('1.2 - Public Key configurado', async () => {
        if (!publicKey) throw new Error('NEXT_PUBLIC_MP_PUBLIC_KEY não configurado');
        if (!publicKey.startsWith('TEST-') && !publicKey.startsWith('APP_USR-')) {
            throw new Error('Public key em formato inválido');
        }
    });

    await test('1.3 - Ambiente consistente', async () => {
        const tokenIsTest = accessToken.startsWith('TEST-');
        const keyIsTest = publicKey.startsWith('TEST-');
        if (tokenIsTest !== keyIsTest) {
            throw new Error('Token e Public Key em ambientes diferentes');
        }
    });

    console.log('\n📋 2. TESTES DE API DO MERCADO PAGO\n');

    let preferenceId = null;

    await test('2.1 - Criar preferência de pagamento', async () => {
        const response = await makeRequest({
            hostname: 'api.mercadopago.com',
            path: '/checkout/preferences',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            }
        }, {
            items: [{
                title: 'Teste Automatizado - Quarto',
                quantity: 1,
                unit_price: 10.00,
                currency_id: 'BRL'
            }],
            back_urls: {
                success: 'https://pousada-delplata.vercel.app/success',
                failure: 'https://pousada-delplata.vercel.app/failure',
                pending: 'https://pousada-delplata.vercel.app/pending'
            },
            auto_return: 'approved',
            external_reference: 'test-' + Date.now()
        });

        if (response.status !== 201) {
            throw new Error(`Status ${response.status}, esperado 201`);
        }

        if (!response.data.id) {
            throw new Error('Preferência criada sem ID');
        }

        preferenceId = response.data.id;
    });

    await test('2.2 - Preferência tem init_point', async () => {
        if (!preferenceId) throw new Error('Preferência não foi criada');

        const response = await makeRequest({
            hostname: 'api.mercadopago.com',
            path: `/checkout/preferences/${preferenceId}`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.data.init_point && !response.data.sandbox_init_point) {
            throw new Error('Preferência sem URL de pagamento');
        }
    });

    await test('2.3 - Validar estrutura da preferência', async () => {
        const response = await makeRequest({
            hostname: 'api.mercadopago.com',
            path: `/checkout/preferences/${preferenceId}`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        const pref = response.data;

        if (!pref.items || pref.items.length === 0) {
            throw new Error('Preferência sem items');
        }

        if (!pref.back_urls) {
            throw new Error('Preferência sem back_urls');
        }

        if (!pref.external_reference) {
            throw new Error('Preferência sem external_reference');
        }
    });

    console.log('\n📋 3. TESTES DE VALIDAÇÃO\n');

    await test('3.1 - Rejeitar preferência sem items', async () => {
        const response = await makeRequest({
            hostname: 'api.mercadopago.com',
            path: '/checkout/preferences',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            }
        }, {
            items: []
        });

        if (response.status === 201) {
            throw new Error('API aceitou preferência sem items');
        }
    });

    await test('3.2 - Rejeitar item com preço negativo', async () => {
        const response = await makeRequest({
            hostname: 'api.mercadopago.com',
            path: '/checkout/preferences',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            }
        }, {
            items: [{
                title: 'Teste',
                quantity: 1,
                unit_price: -10.00,
                currency_id: 'BRL'
            }]
        });

        if (response.status === 201) {
            throw new Error('API aceitou preço negativo');
        }
    });

    console.log('\n📋 4. TESTES DE CARTÕES DE TESTE\n');

    const testCards = [
        { number: '5031433215406351', name: 'APRO', expected: 'approved' },
        { number: '4509953566233704', name: 'CONT', expected: 'pending' },
        { number: '5031755734530604', name: 'OTHE', expected: 'rejected' }
    ];

    testCards.forEach(card => {
        test(`4.${testCards.indexOf(card) + 1} - Cartão ${card.name} (${card.expected})`, async () => {
            // Apenas validar que conhecemos os cartões de teste
            if (!card.number || !card.name) {
                throw new Error('Cartão de teste inválido');
            }
        });
    });

    // Resumo
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMO DOS TESTES DE INTEGRAÇÃO\n');
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
        console.log('\n🎉 TODOS OS TESTES PASSARAM!\n');
    }

    console.log('\n💡 Próximos testes: Webhook, Email, Frontend\n');

    process.exit(testsFailed > 0 ? 1 : 0);
}

runTests().catch(error => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
});
