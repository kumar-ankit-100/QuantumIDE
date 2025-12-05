import { NextResponse } from "next/server";
import { withErrorHandler } from "@/middleware/withErrorHandler";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import Docker from 'dockerode';

const docker = new Docker();

async function listProjectsHandler(request: Request) {
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

    logger.info('Fetching projects for user', { userId });

    // Get projects from database
    const projects = await prisma.project.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        template: true,
        githubRepo: true,
        containerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Check container status for each project
    const projectsWithStatus = await Promise.all(
      projects.map(async (project) => {
        let status = 'stopped';
        
        if (project.containerId) {
          try {
            const container = docker.getContainer(project.containerId);
            const info = await container.inspect();
            status = info.State.Status === 'running' ? 'running' : 'stopped';
          } catch (err) {
            status = 'stopped';
          }
        }

        return {
          id: project.id,
          name: project.name,
          description: project.description || 'No description',
          template: project.template,
          githubRepo: project.githubRepo,
          containerId: project.containerId,
          createdAt: project.createdAt.toISOString(),
          lastModified: project.updatedAt.toISOString(),
          status,
        };
      })
    );

    return NextResponse.json({
      success: true,
      projects: projectsWithStatus,
      count: projectsWithStatus.length,
    });
  } catch (err: any) {
    logger.error('Failed to list projects', err);
    return NextResponse.json(
      { error: `Failed to list projects: ${err.message}` },
      { status: 500 }
    );
  }
}

export const GET = withErrorHandler(listProjectsHandler);