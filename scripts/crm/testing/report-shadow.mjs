import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const reviewDay = new Date().toISOString().slice(0, 10);
const dayStart = new Date(`${reviewDay}T00:00:00.000Z`);

try {
  const logs = await prisma.internalActionLog.findMany({
    where: { action: "IntentClassified", createdAt: { gte: dayStart } },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: { metadataJson: true },
  });
  const metadata = logs.map(log => {
    try {
      return JSON.parse(log.metadataJson ?? "{}");
    } catch {
      return {};
    }
  });
  const shadow = metadata.filter(item => item.mode === "shadow");
  const comparable = shadow.filter(item => typeof item.agreementWithHeuristic === "boolean");
  const agreements = comparable.filter(item => item.agreementWithHeuristic === true).length;
  const authorizedActions = shadow.filter(item => item.actionAuthorized === true).length;

  console.log(JSON.stringify({
    reviewDay,
    sampled: metadata.length,
    shadow: shadow.length,
    authorizedActions,
    agreementRate: comparable.length ? agreements / comparable.length : null,
    gatePassed: shadow.length > 0 && authorizedActions === 0,
  }));
} finally {
  await prisma.$disconnect();
}
