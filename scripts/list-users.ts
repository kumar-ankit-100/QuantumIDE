// scripts/list-users.ts - List all users
import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
    },
  });

  console.log(`👥 Users in database: ${users.length}`);
  console.log('─'.repeat(60));
  users.forEach((u) => {
    console.log(`ID: ${u.id}`);
    console.log(`Name: ${u.name}`);
    console.log(`Email: ${u.email}`);
    console.log(`Created: ${u.createdAt}`);
    console.log('─'.repeat(60));
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
