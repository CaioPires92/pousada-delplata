require('dotenv').config();

const accessToken = process.env.MP_ACCESS_TOKEN;
const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;

console.log('\n=== VERIFICAÇÃO DE CREDENCIAIS MERCADO PAGO ===\n');

if (accessToken) {
    if (accessToken.startsWith('TEST-')) {
        console.log('✅ ACCESS TOKEN: Credenciais de TESTE');
        console.log('   Você pode usar cartões de teste do Mercado Pago');
    } else if (accessToken.startsWith('APP-')) {
        console.log('⚠️  ACCESS TOKEN: Credenciais de PRODUÇÃO');
        console.log('   Cartões de teste NÃO vão funcionar');
        console.log('   Você precisa usar as credenciais de teste para testar pagamentos');
    } else {
        console.log('❓ ACCESS TOKEN: Formato desconhecido');
        console.log('   Primeiros caracteres:', accessToken.substring(0, 10) + '...');
    }
} else {
    console.log('❌ ACCESS TOKEN não encontrado');
}

console.log('');

if (publicKey) {
    if (publicKey.startsWith('TEST-')) {
        console.log('✅ PUBLIC KEY: Credenciais de TESTE');
    } else if (publicKey.startsWith('APP-')) {
        console.log('⚠️  PUBLIC KEY: Credenciais de PRODUÇÃO');
    } else {
        console.log('❓ PUBLIC KEY: Formato desconhecido');
        console.log('   Primeiros caracteres:', publicKey.substring(0, 10) + '...');
    }
} else {
    console.log('⚠️  PUBLIC KEY não encontrado (opcional para Checkout Pro)');
}

console.log('\n=== COMO OBTER CREDENCIAIS DE TESTE ===\n');
console.log('1. Acesse: https://www.mercadopago.com.br/developers/panel/app');
console.log('2. Selecione sua aplicação');
console.log('3. Vá em "Credenciais de teste"');
console.log('4. Copie o Access Token (começa com TEST-)');
console.log('5. Atualize a variável MP_ACCESS_TOKEN no .env\n');
