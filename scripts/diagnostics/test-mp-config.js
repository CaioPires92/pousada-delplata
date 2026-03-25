require('dotenv').config();

console.log('🔍 Verificando Configuração do Mercado Pago...\n');
console.log('='.repeat(60));

const accessToken = process.env.MP_ACCESS_TOKEN;
const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;

console.log('MP_ACCESS_TOKEN:', accessToken ? accessToken.substring(0, 20) + '...' : '❌ NÃO CONFIGURADO');
console.log('NEXT_PUBLIC_MP_PUBLIC_KEY:', publicKey ? publicKey.substring(0, 20) + '...' : '❌ NÃO CONFIGURADO');

if (accessToken) {
    if (accessToken.startsWith('TEST-')) {
        console.log('\n✅ Ambiente: TESTE');
        console.log('💡 Use cartões de teste para pagar');
    } else if (accessToken.startsWith('APP_USR-')) {
        console.log('\n✅ Ambiente: PRODUÇÃO');
        console.log('⚠️  Pagamentos serão REAIS!');
    } else {
        console.log('\n❌ Token inválido!');
    }
}

console.log('='.repeat(60));

// Testar criação de preferência
console.log('\n🧪 Testando criação de preferência de pagamento...\n');

const https = require('https');

const preferenceData = JSON.stringify({
    items: [{
        title: 'Teste - Apartamento Superior',
        quantity: 1,
        unit_price: 10.00,
        currency_id: 'BRL'
    }],
    back_urls: {
        success: 'https://pousada-delplata.vercel.app/reservar/confirmacao/test-123?status=approved',
        failure: 'https://pousada-delplata.vercel.app/reservar/confirmacao/test-123?status=rejected',
        pending: 'https://pousada-delplata.vercel.app/reservar/confirmacao/test-123?status=pending'
    },
    auto_return: 'approved',
    external_reference: 'test-123'
});

const options = {
    hostname: 'api.mercadopago.com',
    port: 443,
    path: '/checkout/preferences',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'Content-Length': Buffer.byteLength(preferenceData)
    }
};

const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            const result = JSON.parse(data);

            if (result.id) {
                console.log('✅ Preferência criada com sucesso!');
                console.log('\nDetalhes:');
                console.log('- ID:', result.id);
                console.log('- Init Point:', result.init_point || '❌ Não disponível');
                console.log('- Sandbox Init Point:', result.sandbox_init_point || '❌ Não disponível');

                if (result.sandbox_init_point) {
                    console.log('\n✅ URL de Teste:', result.sandbox_init_point);
                    console.log('\n💡 Acesse esta URL em uma aba anônima e tente pagar com:');
                    console.log('   Cartão: 5031 4332 1540 6351');
                    console.log('   Nome: APRO');
                    console.log('   CVV: 123');
                    console.log('   Data: 11/25');
                }
            } else {
                console.log('❌ Erro ao criar preferência:');
                console.log(JSON.stringify(result, null, 2));
            }
        } catch (e) {
            console.log('❌ Erro ao processar resposta:', data);
        }
    });
});

req.on('error', (error) => {
    console.error('❌ Erro na requisição:', error.message);
});

req.write(preferenceData);
req.end();
