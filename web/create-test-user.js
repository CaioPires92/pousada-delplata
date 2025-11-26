const https = require('https');

const accessToken = 'TEST-1242598103832964-110108-885c9ac376c2197ba5cf7fa183b32a9b-39563078';

// Criar usuário de teste COMPRADOR
const buyerData = JSON.stringify({
    site_id: 'MLB'
});

const options = {
    hostname: 'api.mercadopago.com',
    port: 443,
    path: '/users/test_user',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'Content-Length': buyerData.length
    }
};

console.log('Criando nova conta de teste de COMPRADOR...\n');

const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        const user = JSON.parse(data);
        console.log('✅ Conta de COMPRADOR criada com sucesso!\n');
        console.log('='.repeat(50));
        console.log('NOVA CONTA DE TESTE - COMPRADOR');
        console.log('='.repeat(50));
        console.log(`Usuário: ${user.username}`);
        console.log(`Senha: ${user.password}`);
        console.log(`Email: ${user.email}`);
        console.log('='.repeat(50));
        console.log('\n💡 Use estas credenciais para fazer login no Mercado Pago');
        console.log('💡 Ou use apenas o cartão de teste sem fazer login\n');
    });
});

req.on('error', (error) => {
    console.error('Erro ao criar conta:', error);
});

req.write(buyerData);
req.end();
