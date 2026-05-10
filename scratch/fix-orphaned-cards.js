const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Verificando PipelineCards órfãos ---');
  
  const cards = await prisma.pipelineCard.findMany({
    select: { id: true, contactId: true }
  });
  
  const contacts = await prisma.contact.findMany({
    select: { id: true }
  });
  
  const contactIds = new Set(contacts.map(c => c.id));
  const orphanedCards = cards.filter(card => !contactIds.has(card.contactId));
  
  console.log(`Total de cards: ${cards.length}`);
  console.log(`Total de contatos: ${contacts.length}`);
  console.log(`Cards órfãos encontrados: ${orphanedCards.length}`);
  
  if (orphanedCards.length > 0) {
    console.log('Removendo cards órfãos...');
    for (const card of orphanedCards) {
      await prisma.pipelineCard.delete({
        where: { id: card.id }
      });
      console.log(`Removido card: ${card.id} (contactId: ${card.contactId})`);
    }
    console.log('Limpeza concluída.');
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
