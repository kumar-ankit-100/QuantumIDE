// scripts/migrate-existing-projects.ts - Add existing container projects to database
import { PrismaClient } from '../src/generated/prisma';
import Docker from 'dockerode';

const prisma = new PrismaClient();
const docker = new Docker();

async function main() {
  console.log('🔍 Scanning for existing containers...');
  
  const containers = await docker.listContainers({ all: true });
  // QuantumIDE containers use UUID as names
  const quantumideContainers = containers.filter(c => {
    const name = c.Names[0]?.replace('/', '') || '';
    // Check if name is a UUID format
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name);
  });

  console.log(`Found ${quantumideContainers.length} QuantumIDE containers`);

  for (const containerInfo of quantumideContainers) {
    const projectId = containerInfo.Names[0]?.replace('/', '') || '';
    const projectName = `Project ${projectId.slice(0, 8)}`;

    try {
      // Check if already in database
      const existing = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (existing) {
        console.log(`✓ Project ${projectName} already in database`);
        continue;
      }

      // Get metadata from container if running
      let githubRepo = null;
      let template = 'react-vite';
      
      if (containerInfo.State === 'running') {
        try {
          const container = docker.getContainer(containerInfo.Id);
          const exec = await container.exec({
            Cmd: ['cat', '/app/.quantumide-metadata.json'],
            AttachStdout: true,
            AttachStderr: true,
          });
          
          const stream = await exec.start({ Detach: false });
          let output = '';
          
          stream.on('data', (chunk: Buffer) => {
            output += chunk.toString();
          });
          
          await new Promise((resolve) => stream.on('end', resolve));
          
          // Parse metadata
          const cleanOutput = output.replace(/[\x00-\x08]/g, '');
          const metadata = JSON.parse(cleanOutput);
          githubRepo = metadata.githubRepo;
          template = metadata.template || 'react-vite';
        } catch (err) {
          console.log(`⚠️  Could not read metadata for ${projectName}`);
        }
      }

      // Add to database with default user
      await prisma.project.create({
        data: {
          id: projectId,
          name: projectName,
          description: 'Migrated from existing container',
          template,
          githubRepo,
          containerId: containerInfo.Id,
          userId: 'default-user', // Use default user for migrated projects
        },
      });

      console.log(`✅ Added ${projectName} to database`);
    } catch (error) {
      console.error(`❌ Failed to migrate ${projectName}:`, error);
    }
  }

  console.log('\n✨ Migration complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
