// app/api/projects/resume/route.ts - Resume project by cloning from GitHub
import { NextResponse } from 'next/server';
import { withErrorHandler } from '@/middleware/withErrorHandler';
import { logger } from '@/lib/logger';
import { createContainer } from '@/lib/containerManager';
import { cloneFromGitHub } from '@/lib/github';
import Docker from 'dockerode';

const docker = new Docker();

async function resumeHandler(request: Request) {
  try {
    const { projectId, githubRepo, githubToken } = await request.json();

    if (!projectId || !githubRepo) {
      return NextResponse.json(
        { error: 'Project ID and GitHub repo are required' },
        { status: 400 }
      );
    }

    logger.info('Resuming project', { projectId, repo: githubRepo });

    // Check if container already exists
    try {
      const existing = docker.getContainer(projectId);
      const info = await existing.inspect();
      
      if (info.State.Status === 'running') {
        return NextResponse.json({
          success: true,
          projectId,
          containerId: existing.id,
          message: 'Container already running',
        });
      }
    } catch {
      // Container doesn't exist, create new one
    }

    // Create metadata
    const metadata = {
      id: projectId,
      name: githubRepo.split('/').pop() || projectId,
      description: 'Resumed from GitHub',
      template: 'custom',
      techStack: [],
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      githubRepo: githubRepo,
      serverConfig: {
        type: 'vite',
        defaultPort: 5173,
        devCommand: 'npm run dev -- --host 0.0.0.0'
      }
    };

    // Create new container
    const container = await createContainer(projectId, metadata);

    // Clone from GitHub
    try {
      await cloneFromGitHub(container, githubRepo, githubToken);
      logger.info('Project cloned from GitHub', { projectId, repo: githubRepo });
    } catch (cloneErr: any) {
      // Cleanup container on failure
      try {
        await container.stop({ t: 5 });
        await container.remove({ force: true });
      } catch {}
      
      throw new Error(`Failed to clone from GitHub: ${cloneErr.message}`);
    }

    return NextResponse.json({
      success: true,
      projectId,
      containerId: container.id,
      message: 'Project resumed successfully',
      githubRepo,
    });

  } catch (error: any) {
    logger.error('Resume project failed', error);
    return NextResponse.json(
      { error: error.message || 'Failed to resume project' },
      { status: 500 }
    );
  }
}

export const POST = withErrorHandler(resumeHandler);
