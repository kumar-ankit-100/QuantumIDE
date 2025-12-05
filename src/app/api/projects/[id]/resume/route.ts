// app/api/projects/[id]/resume/route.ts - Resume project from GitHub
import { NextResponse } from 'next/server';
import Docker from 'dockerode';
import { withErrorHandler } from '@/middleware/withErrorHandler';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { cloneFromGitHub } from '@/lib/github';
import { execCommand } from '@/lib/containerFileHelpers';

const docker = new Docker();

async function resumeHandler(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let container: Docker.Container | null = null;

  try {
    // Get authenticated user from session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;
    const { id: projectId } = await params;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    logger.info('Resuming project', { projectId, userId });

    // Get project from database and verify ownership
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project || project.userId !== userId) {
      return NextResponse.json(
        { error: 'Project not found or unauthorized' },
        { status: 404 }
      );
    }

    if (!project.githubRepo) {
      return NextResponse.json(
        { error: 'No GitHub repository linked to this project' },
        { status: 400 }
      );
    }

    // Check if container already exists (by ID from database or by name)
    let existingContainer: Docker.Container | null = null;
    
    // First check if we have a container ID in the database
    if (project.containerId) {
      try {
        existingContainer = docker.getContainer(project.containerId);
        const info = await existingContainer.inspect();
        
        if (info.State.Status === 'running') {
          logger.info('Container already running', { projectId, containerId: project.containerId });
          return NextResponse.json({
            success: true,
            projectId,
            containerId: project.containerId,
            message: 'Project already running',
          });
        }
      } catch (err) {
        logger.info('Container ID from database not found', { projectId, containerId: project.containerId });
      }
    }
    
    // Check if any container exists with this project name
    try {
      const containers = await docker.listContainers({ all: true });
      const containerWithName = containers.find(c => 
        c.Names?.some(name => name.includes(projectId))
      );
      
      if (containerWithName) {
        logger.info('Found existing container with project name, removing it', { 
          projectId, 
          containerId: containerWithName.Id 
        });
        
        const oldContainer = docker.getContainer(containerWithName.Id);
        try {
          // Stop if running
          if (containerWithName.State === 'running') {
            await oldContainer.stop({ t: 5 });
          }
          // Remove the container
          await oldContainer.remove({ force: true });
          logger.info('Old container removed', { projectId });
        } catch (removeErr) {
          logger.warn('Failed to remove old container', { projectId, error: removeErr });
          // Continue anyway - the create might still work
        }
      }
    } catch (listErr) {
      logger.warn('Failed to list containers', { projectId, error: listErr });
    }

    // Create project metadata
    const projectMetadata = {
      id: projectId,
      name: project.name,
      description: project.description || '',
      template: project.template,
      createdAt: project.createdAt.toISOString(),
      lastModified: project.updatedAt.toISOString(),
      githubRepo: project.githubRepo,
      serverConfig: {
        type: project.template === 'nextjs' || project.template === 'fullstack-nextjs' ? 'nextjs' : 
              project.template === 'react-vite' ? 'vite' : 
              project.template === 'node-express' ? 'express' : 'vite',
        defaultPort: project.template === 'nextjs' || project.template === 'fullstack-nextjs' ? 3000 : 5173,
        devCommand: project.template === 'nextjs' || project.template === 'fullstack-nextjs' ? 'npm run dev' : 
                    project.template === 'node-express' ? 'npm run dev' : 
                    'npm run dev -- --host 0.0.0.0'
      }
    };

    // Create new container
    logger.info('Creating new container for project', { projectId });
    
    container = await docker.createContainer({
      Image: 'node:20',
      name: projectId,
      Cmd: ['tail', '-f', '/dev/null'],
      WorkingDir: '/app',
      HostConfig: {
        AutoRemove: false,
        PublishAllPorts: true,
        Binds: [],
      },
      Labels: {
        'quantumide.project.id': projectId,
        'quantumide.project.name': project.name,
      },
    });

    await container.start();
    logger.info('Container started', { projectId, containerId: container.id });

    // Clone project from GitHub
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      throw new Error('GitHub token not configured');
    }

    logger.info('Cloning from GitHub', { projectId, repo: project.githubRepo });
    await cloneFromGitHub(container, project.githubRepo, 'main', githubToken);
    logger.info('Clone complete', { projectId });

    // Save metadata to container
    await execCommand(
      container,
      ["bash", "-c", `echo '${JSON.stringify(projectMetadata, null, 2).replace(/'/g, "'\\''")}' > /app/.quantumide-metadata.json`],
      "/app"
    );

    // Install dependencies
    logger.info('Installing dependencies', { projectId });
    try {
      await execCommand(container, ['npm', 'install'], '/app');
      logger.info('Dependencies installed', { projectId });
    } catch (installErr: any) {
      logger.warn('Failed to install dependencies', { projectId, error: installErr.message });
      // Continue even if install fails - user can manually install
    }

    // Update database with new container ID
    await prisma.project.update({
      where: { id: projectId },
      data: { 
        containerId: container.id,
        updatedAt: new Date(),
      },
    });

    logger.info('Project resumed successfully', { projectId, containerId: container.id });

    return NextResponse.json({
      success: true,
      projectId,
      containerId: container.id,
      githubRepo: project.githubRepo,
      message: 'Project resumed from GitHub',
    });
  } catch (error: any) {
    logger.error('Failed to resume project', error);

    // Cleanup container if created
    if (container) {
      try {
        await container.stop({ t: 5 });
        await container.remove({ force: true });
      } catch (cleanupErr) {
        logger.error('Failed to cleanup container', cleanupErr as Error);
      }
    }

    return NextResponse.json(
      { error: error.message || 'Failed to resume project' },
      { status: 500 }
    );
  }
}

export const POST = withErrorHandler(resumeHandler);
