import { NextRequest, NextResponse } from "next/server";
import Docker from "dockerode";
import fs from "fs-extra";
import path from "path";

const docker = new Docker();
const PROJECTS_DIR = path.join(process.cwd(), "projects");

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    
    console.log(`[DELETE] Deleting project: ${projectId}`);
    
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
    
    return NextResponse.json({ 
      success: true, 
      message: "Project and container deleted successfully" 
    });
  } catch (err: any) {
    console.error(`[DELETE] Failed to delete project: ${err.message}`);
    return NextResponse.json(
      { error: `Failed to delete project: ${err.message}` },
      { status: 500 }
    );
  }
}
