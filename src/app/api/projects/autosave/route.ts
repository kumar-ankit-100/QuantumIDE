// app/api/projects/autosave/route.ts - Auto-save project changes to GitHub
import { NextResponse } from 'next/server';
import Docker from 'dockerode';
import { withErrorHandler } from '@/middleware/withErrorHandler';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { commitChanges, pushToGitHub } from '@/lib/github';

const docker = new Docker();

async function autosaveHandler(request: Request) {
  try {
    logger.info('[Autosave] Request received');
    
    // Get authenticated user from session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.error('[Autosave] Unauthorized - no session');
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;
    const { projectId } = await request.json();
    
    logger.info('[Autosave] Request details', { projectId, userId });

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

    // Always use server-side GitHub token
    const githubToken = process.env.GITHUB_TOKEN;
    
    if (!githubToken) {
      logger.error('[Autosave] No GitHub token configured');
      return NextResponse.json(
        { error: 'GitHub token not configured on server' },
        { status: 500 }
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
      logger.info('[Autosave] Starting commit', { projectId });
      await commitChanges(container, 'Auto-save from QuantumIDE');
      logger.info('[Autosave] Commit successful', { projectId });
    } catch (commitErr: any) {
      logger.warn('[Autosave] Commit error', { error: commitErr.message });
      // No changes to commit is okay
      if (!commitErr.message.includes('nothing to commit')) {
        throw commitErr;
      }
    }

    // Push to GitHub
    try {
      logger.info('[Autosave] Starting push', { projectId, repo: metadata.githubRepo });
      await pushToGitHub(container, metadata.githubRepo, 'main', githubToken);
      logger.info('[Autosave] Push successful', { projectId, repo: metadata.githubRepo });
      
      return NextResponse.json({
        success: true,
        message: 'Changes saved to GitHub',
        timestamp: new Date().toISOString(),
      });
    } catch (pushErr: any) {
      logger.error('[Autosave] Push failed', { projectId, error: pushErr.message });
      return NextResponse.json({
        success: true,
        committed: true,
        pushed: false,
        message: 'Changes committed locally but push failed',
        error: pushErr.message,
      }, { status: 500 });
    }

  } catch (error: any) {
    logger.error('Auto-save failed', error);
    
    // Check if it's a container not found error
    const isContainerNotFound = error.message && error.message.includes('no such container');
    
    return NextResponse.json(
      { 
        error: error.message || 'Auto-save failed',
        containerNotFound: isContainerNotFound,
      },
      { status: 500 }
    );
  }
}

export const POST = withErrorHandler(autosaveHandler);
