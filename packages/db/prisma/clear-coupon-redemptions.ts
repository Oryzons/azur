import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const res = await prisma.couponRedemption.deleteMany({});
  console.log(`OK — ${res.count} utilisation(s) de coupons supprimée(s)`);
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

