// Script para testar envio de email
// Execute com: node scripts/test-email.js BOOKING_ID

const bookingId = process.argv[2];

if (!bookingId) {
    console.error('Uso: node scripts/test-email.js BOOKING_ID');
    console.error('Exemplo: node scripts/test-email.js b923c8e9-dbec-4045-922a-a453910b1f8e');
    process.exit(1);
}

console.log(`\n🧪 Testando envio de email para reserva: ${bookingId}\n`);

fetch('http://localhost:3001/api/test-email', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({ bookingId }),
})
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            console.error('❌ Erro:', data.error);
            if (data.details) {
                console.error('Detalhes:', data.details);
            }
        } else {
            console.log('✅ Sucesso!', data);
            console.log(`\n📧 Email enviado para: ${data.sentTo}`);
            console.log(`📬 Message ID: ${data.messageId}\n`);
        }
    })
    .catch(error => {
        console.error('❌ Erro na requisição:', error.message);
        console.log('\n💡 Verifique se:');
        console.log('  1. O servidor está rodando (npm run dev)');
        console.log('  2. As variáveis SMTP estão configuradas no .env');
        console.log('  3. O booking ID existe no banco de dados\n');
    });
