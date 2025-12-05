// app/api/projects/[id]/cleanup/route.ts - Cleanup container when user exits project
import { NextResponse } from 'next/server';
import Docker from 'dockerode';
import { withErrorHandler } from '@/middleware/withErrorHandler';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { commitChanges, pushToGitHub } from '@/lib/github';

const docker = new Docker();

async function cleanupHandler(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Verify project belongs to user
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project || project.userId !== userId) {
      return NextResponse.json(
        { error: 'Project not found or unauthorized' },
        { status: 404 }
      );
    }

    logger.info('Cleaning up project', { projectId });

    // Get container
    const container = docker.getContainer(projectId);
    
    try {
      const info = await container.inspect();

      if (info.State.Status === 'running') {
        // Get metadata and GitHub repo info
        const { execCommand } = await import('@/lib/containerFileHelpers');
        let githubRepo = null;
        
        try {
          const metadataJson = await execCommand(
            container,
            ['cat', '/app/.quantumide-metadata.json'],
            '/app'
          );
          const metadata = JSON.parse(metadataJson);
          githubRepo = metadata.githubRepo;
        } catch (err) {
          logger.warn('Could not read metadata', { projectId });
        }

        // Commit and push final changes to GitHub before cleanup
        if (githubRepo) {
          const githubToken = process.env.GITHUB_TOKEN;
          if (githubToken) {
            try {
              await commitChanges(container, 'Final save before container cleanup');
              await pushToGitHub(container, githubRepo, 'main', githubToken);
              logger.info('Final push to GitHub complete', { projectId, githubRepo });
            } catch (pushErr: any) {
              logger.warn('Failed to push final changes', { projectId, error: pushErr.message });
            }
          }
        }

        // Stop the container
        try {
          await container.stop({ t: 10 });
          logger.info('Container stopped', { projectId });
        } catch (stopErr: any) {
          // Ignore if already stopped
          if (stopErr.statusCode !== 304) {
            throw stopErr;
          }
          logger.info('Container already stopped', { projectId });
        }
      }

      // Remove the container
      try {
        await container.remove({ force: true });
        logger.info('Container removed', { projectId });
      } catch (removeErr: any) {
        // Ignore if removal already in progress or container doesn't exist
        if (removeErr.statusCode !== 404 && removeErr.statusCode !== 409) {
          throw removeErr;
        }
        logger.info('Container removal already in progress or completed', { projectId });
      }

      // Update database to clear containerId
      try {
        await prisma.project.update({
          where: { id: projectId },
          data: { containerId: null },
        });
        logger.info('Database updated - container cleared', { projectId });
      } catch (dbErr: any) {
        logger.warn('Failed to update database', { projectId, error: dbErr.message });
      }

      return NextResponse.json({
        success: true,
        message: 'Container cleaned up successfully',
      });
    } catch (inspectErr: any) {
      if (inspectErr.statusCode === 404) {
        // Container doesn't exist, just clear database
        try {
          await prisma.project.update({
            where: { id: projectId },
            data: { containerId: null },
          });
        } catch (dbErr) {
          // Ignore database errors
        }
        return NextResponse.json({
          success: true,
          message: 'Container already removed',
        });
      }
      throw inspectErr;
    }
  } catch (error: any) {
    logger.error('Cleanup failed', error);
    return NextResponse.json(
      { error: error.message || 'Cleanup failed' },
      { status: 500 }
    );
  }
}

export const POST = withErrorHandler(cleanupHandler);
export const DELETE = withErrorHandler(cleanupHandler);
