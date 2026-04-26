const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const rooms = await prisma.roomType.findMany({ select: { id: true, name: true, externalId: true } });
  console.log(JSON.stringify(rooms, null, 2));
  await prisma.$disconnect();
}
main();
