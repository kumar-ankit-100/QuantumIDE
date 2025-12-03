// app/api/projects/autosave/route.ts - Auto-save project changes to GitHub
import { NextResponse } from 'next/server';
import Docker from 'dockerode';
import { withErrorHandler } from '@/middleware/withErrorHandler';
import { logger } from '@/lib/logger';
import { commitChanges, pushToGitHub } from '@/lib/github';

const docker = new Docker();

async function autosaveHandler(request: Request) {
  try {
    const { projectId, githubToken } = await request.json();

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Get container
    const container = docker.getContainer(projectId);
    const info = await container.inspect();

    if (info.State.Status !== 'running') {
      return NextResponse.json(
        { error: 'Container is not running' },
        { status: 400 }
      );
    }

    // Get metadata from container
    const { execCommand } = await import('@/lib/containerFileHelpers');
    const metadataJson = await execCommand(
      container,
      ['cat', '/app/.quantumide-metadata.json'],
      '/app'
    );
    const metadata = JSON.parse(metadataJson);

    if (!metadata.githubRepo) {
      return NextResponse.json(
        { error: 'No GitHub repository connected', needsSetup: true },
        { status: 400 }
      );
    }

    // Auto-commit changes
    try {
      await commitChanges(container, 'Auto-save from QuantumIDE');
      logger.info('Auto-save committed', { projectId });
    } catch (commitErr: any) {
      // No changes to commit is okay
      if (!commitErr.message.includes('nothing to commit')) {
        throw commitErr;
      }
    }

    // Push to GitHub if token provided
    if (githubToken) {
      try {
        await pushToGitHub(container, metadata.githubRepo, githubToken);
        logger.info('Auto-save pushed to GitHub', { projectId, repo: metadata.githubRepo });
        
        return NextResponse.json({
          success: true,
          message: 'Changes auto-saved to GitHub',
          timestamp: new Date().toISOString(),
        });
      } catch (pushErr: any) {
        logger.warn('Auto-save push failed', { projectId, error: pushErr.message });
        return NextResponse.json({
          success: true,
          committed: true,
          pushed: false,
          message: 'Changes committed locally but push failed',
          error: pushErr.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      committed: true,
      pushed: false,
      message: 'Changes committed locally (no token provided for push)',
    });

  } catch (error: any) {
    logger.error('Auto-save failed', error);
    return NextResponse.json(
      { error: error.message || 'Auto-save failed' },
      { status: 500 }
    );
  }
}

export const POST = withErrorHandler(autosaveHandler);
