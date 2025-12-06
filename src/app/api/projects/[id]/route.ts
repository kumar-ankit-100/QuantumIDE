import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { Octokit } from '@octokit/rest';
import Docker from 'dockerode';
import { logger } from '@/lib/logger';

const docker = new Docker();

/**
 * DELETE /api/projects/[id]
 * Delete a project completely:
 * 1. Stop and remove Docker container
 * 2. Delete GitHub repository
 * 3. Delete from database
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;
    const { id: projectId } = await params;

    // Verify project belongs to user
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        userId: true,
        name: true,
        githubRepo: true,
      },
    });

    if (!project || project.userId !== userId) {
      return NextResponse.json(
        { error: 'Project not found or unauthorized' },
        { status: 404 }
      );
    }

    logger.info('Deleting project', { projectId, projectName: project.name });

    // 1. Try to remove Docker container (don't fail if it doesn't exist)
    try {
      const container = docker.getContainer(projectId);
      await container.stop({ t: 5 });
      await container.remove({ force: true });
      logger.info('Container removed', { projectId });
    } catch (containerErr: any) {
      // Container might not exist or already removed
      logger.warn('Container removal failed or not found', { projectId, error: containerErr.message });
    }

    // 2. Delete GitHub repository if it exists
    if (project.githubRepo) {
      const githubToken = process.env.GITHUB_TOKEN;
      if (githubToken) {
        try {
          const octokit = new Octokit({ auth: githubToken });
          
          // Extract owner and repo from githubRepo (format: "owner/repo")
          const [owner, repo] = project.githubRepo.split('/');
          
          if (owner && repo) {
            await octokit.repos.delete({
              owner,
              repo,
            });
            logger.info('GitHub repository deleted', { projectId, githubRepo: project.githubRepo });
          }
        } catch (githubErr: any) {
          // Log but don't fail - repository might already be deleted
          logger.warn('GitHub repository deletion failed', { 
            projectId, 
            githubRepo: project.githubRepo,
            error: githubErr.message 
          });
        }
      } else {
        logger.warn('GitHub token not available, skipping repository deletion', { projectId });
      }
    }

    // 3. Delete from database
    await prisma.project.delete({
      where: { id: projectId },
    });

    logger.info('Project deleted from database', { projectId });

    return NextResponse.json({
      success: true,
      message: 'Project deleted successfully',
    });
  } catch (error: any) {
    logger.error('Project deletion failed', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete project' },
      { status: 500 }
    );
  }
}
