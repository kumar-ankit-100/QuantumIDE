import { NextRequest, NextResponse } from "next/server";
import Docker from "dockerode";
import fs from "fs-extra";
import path from "path";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { PrismaClient } from "@/generated/prisma/client";
import { Octokit } from "@octokit/rest";

const docker = new Docker();
const PROJECTS_DIR = path.join(process.cwd(), "projects");
const prisma = new PrismaClient();

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    
    console.log(`[DELETE] Deleting project: ${projectId}`);
    
    // Get session and verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Get project from database
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });
    
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    
    // Verify user owns the project
    if (project.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    
    // 1. Stop and remove the container
    try {
      const containers = await docker.listContainers({ all: true });
      const projectContainer = containers.find(c => 
        c.Names.some(name => name === `/${projectId}`)
      );
      
      if (projectContainer) {
        console.log(`[DELETE] Found container: ${projectContainer.Id}`);
        const container = docker.getContainer(projectContainer.Id);
        
        // Stop container if running
        if (projectContainer.State === 'running') {
          console.log(`[DELETE] Stopping container...`);
          await container.stop({ t: 5 }).catch((err) => {
            console.log(`[DELETE] Container already stopped or error: ${err.message}`);
          });
        }
        
        // Remove container
        console.log(`[DELETE] Removing container...`);
        await container.remove({ force: true });
        console.log(`[DELETE] Container removed successfully`);
      } else {
        console.log(`[DELETE] No container found for project ${projectId}`);
      }
    } catch (err: any) {
      console.error(`[DELETE] Error removing container: ${err.message}`);
      // Continue even if container removal fails
    }
    
    // 2. Delete project metadata folder
    const projectFolder = path.join(PROJECTS_DIR, projectId);
    if (await fs.pathExists(projectFolder)) {
      console.log(`[DELETE] Removing project folder: ${projectFolder}`);
      await fs.remove(projectFolder);
      console.log(`[DELETE] Project folder removed successfully`);
    } else {
      console.log(`[DELETE] Project folder not found: ${projectFolder}`);
    }
    
    // 3. Delete GitHub repository
    if (project.githubRepo) {
      try {
        const githubToken = process.env.GITHUB_TOKEN;
        if (githubToken) {
          const octokit = new Octokit({ auth: githubToken });
          
          // Extract owner and repo from URL
          // Format: https://github.com/owner/repo.git
          const repoMatch = project.githubRepo.match(/github\.com[/:]([^/]+)\/(.+?)(\.git)?$/);
          
          if (repoMatch) {
            const [, owner, repo] = repoMatch;
            console.log(`[DELETE] Deleting GitHub repository: ${owner}/${repo}`);
            
            await octokit.repos.delete({
              owner,
              repo: repo.replace('.git', '')
            });
            
            console.log(`[DELETE] GitHub repository deleted successfully`);
          } else {
            console.log(`[DELETE] Could not parse GitHub repo URL: ${project.githubRepo}`);
          }
        } else {
          console.log(`[DELETE] No GitHub token found, skipping repository deletion`);
        }
      } catch (err: any) {
        console.error(`[DELETE] Error deleting GitHub repository: ${err.message}`);
        // Continue even if GitHub deletion fails
      }
    }
    
    // 4. Delete from database
    await prisma.project.delete({
      where: { id: projectId }
    });
    console.log(`[DELETE] Project deleted from database`);
    
    return NextResponse.json({ 
      success: true, 
      message: "Project deleted successfully from database, container, and GitHub" 
    });
  } catch (err: any) {
    console.error(`[DELETE] Failed to delete project: ${err.message}`);
    return NextResponse.json(
      { error: `Failed to delete project: ${err.message}` },
      { status: 500 }
    );
  }
}
