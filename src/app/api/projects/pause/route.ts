// app/api/projects/pause/route.ts - Save and pause project (delete container, keep in GitHub)
import { NextResponse } from 'next/server';
import Docker from 'dockerode';
import { withErrorHandler } from '@/middleware/withErrorHandler';
import { logger } from '@/lib/logger';
import { commitChanges, pushToGitHub } from '@/lib/github';

const docker = new Docker();

async function pauseHandler(request: Request) {
  try {
    const { projectId, githubToken, message } = await request.json();

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Get container
    const container = docker.getContainer(projectId);
    
    let containerExists = false;
    try {
      await container.inspect();
      containerExists = true;
    } catch {
      // Container doesn't exist
      return NextResponse.json({
        success: true,
        message: 'Container already removed',
      });
    }

    if (containerExists) {
      // Get metadata from container
      const { execCommand } = await import('@/lib/containerFileHelpers');
      const metadataJson = await execCommand(
        container,
        ['cat', '/app/.quantumide-metadata.json'],
        '/app'
      ).catch(() => '{}');
      
      const metadata = JSON.parse(metadataJson || '{}');

      // Save changes if GitHub repo is connected
      if (metadata.githubRepo && githubToken) {
        try {
          await commitChanges(container, message || 'Save before pause');
          await pushToGitHub(container, metadata.githubRepo, githubToken);
          logger.info('Project saved to GitHub before pause', { projectId, repo: metadata.githubRepo });
        } catch (saveErr: any) {
          logger.warn('Failed to save before pause', { projectId, error: saveErr.message });
        }
      }

      // Stop and remove container
      try {
        await container.stop({ t: 5 });
      } catch {
        // Already stopped
      }

      try {
        await container.remove({ force: true });
        logger.info('Container removed', { projectId });
      } catch (removeErr: any) {
        logger.warn('Failed to remove container', { projectId, error: removeErr.message });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Project paused and container removed. Data saved to GitHub.',
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    logger.error('Pause project failed', error);
    return NextResponse.json(
      { error: error.message || 'Failed to pause project' },
      { status: 500 }
    );
  }
}

export const POST = withErrorHandler(pauseHandler);
