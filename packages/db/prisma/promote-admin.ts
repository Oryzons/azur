import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

function usage() {
  console.log('Usage: npm run promote:admin --workspace=@bleu-calanque/db -- <email>');
}

const emailArg = process.argv.slice(2).find(Boolean);
if (typeof emailArg === 'string') {
  const email = emailArg.toLowerCase();

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.user.update({
        where: { email },
        data: { role: UserRole.ADMIN },
      });
      console.log(`OK — ${email} est maintenant ADMIN`);
    } else {
      console.error(`Utilisateur introuvable: ${email}`);
      process.exitCode = 1;
    }
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
} else {
  usage();
  await prisma.$disconnect();
  process.exit(1);
}

