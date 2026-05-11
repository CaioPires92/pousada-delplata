const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Populando regras do Chatbot ---');
  
  const rules = [
    {
      trigger: 'Oi',
      response: 'Olá! Bem-vindo à Pousada Delplata. Como podemos ajudar você hoje? 🌊',
      category: 'saudacao'
    },
    {
      trigger: 'Preço',
      response: 'Nossas tarifas variam conforme a data e o tipo de quarto. Você pode consultar a disponibilidade real e os valores diretamente em nosso site: https://delplata.com.br/reservar',
      category: 'precos'
    },
    {
      trigger: 'Localização',
      response: 'Estamos localizados na Rua das Palmeiras, nº 123, de frente para o mar! 📍 Confira no mapa: https://maps.google.com/?q=delplata',
      category: 'faq'
    }
  ];

  for (const rule of rules) {
    await prisma.chatbotRule.upsert({
      where: { trigger: rule.trigger },
      update: rule,
      create: rule
    });
    console.log(`Regra configurada: ${rule.trigger}`);
  }

  console.log('Setup concluído!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
