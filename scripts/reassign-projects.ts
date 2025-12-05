// scripts/reassign-projects.ts - Reassign projects to authenticated user
import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: npx tsx scripts/reassign-projects.ts <from-userId> <to-userId>');
    console.log('Example: npx tsx scripts/reassign-projects.ts default-user cmi4m0i8a0000fzf48z1xrvyq');
    process.exit(1);
  }

  const [fromUserId, toUserId] = args;

  console.log(`📝 Reassigning projects from ${fromUserId} to ${toUserId}...`);

  // Check if target user exists
  const targetUser = await prisma.user.findUnique({
    where: { id: toUserId },
  });

  if (!targetUser) {
    console.error(`❌ User ${toUserId} not found in database`);
    process.exit(1);
  }

  // Reassign projects
  const result = await prisma.project.updateMany({
    where: { userId: fromUserId },
    data: { userId: toUserId },
  });

  console.log(`✅ Reassigned ${result.count} projects to ${targetUser.name} (${targetUser.email})`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
