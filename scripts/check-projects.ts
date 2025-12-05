// scripts/check-projects.ts - Check projects in database
import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      userId: true,
      githubRepo: true,
      createdAt: true,
    },
  });

  console.log('📦 Projects in database:', projects.length);
  console.log('─'.repeat(60));
  projects.forEach((p) => {
    console.log(`ID: ${p.id}`);
    console.log(`Name: ${p.name}`);
    console.log(`User: ${p.userId}`);
    console.log(`GitHub: ${p.githubRepo || 'None'}`);
    console.log(`Created: ${p.createdAt}`);
    console.log('─'.repeat(60));
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
