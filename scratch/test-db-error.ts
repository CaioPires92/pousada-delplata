import prisma from '../src/lib/prisma';

async function main() {
  try {
    console.log("DATABASE_URL:", process.env.DATABASE_URL);
    const result = await prisma.inventoryAdjustment.findFirst();
    console.log("Success! Found:", result);
  } catch (error) {
    console.error("Error querying database:", error);
  }
}

main();
