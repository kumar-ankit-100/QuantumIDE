// scripts/add-user-manually.ts - Add a user manually
import { PrismaClient } from '../src/generated/prisma';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const userId = 'cmir8bmjq0000fzgj407a3wic';
  const name = 'ankit';
  const email = 'ankit@ankit.com';
  const password = 'password'; // Change this

  // Check if user already exists
  const existing = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (existing) {
    console.log('✓ User already exists:', existing);
    return;
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create user
  const user = await prisma.user.create({
    data: {
      id: userId,
      name,
      email,
      password: hashedPassword,
    },
  });

  console.log('✅ User created:', user);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
