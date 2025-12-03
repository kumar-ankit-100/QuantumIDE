import { NextRequest, NextResponse } from "next/server";
import Docker from "dockerode";
import { commitChanges, pushToGitHub, getGitStatus } from "@/lib/github";

const docker = new Docker();

export async function POST(req: NextRequest) {
  const { projectId, repoUrl, message, token } = await req.json();

  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  try {
    // Find container
    const containers = await docker.listContainers({ all: true });
    const containerData = containers.find(c => 
      c.Names?.some(name => name.includes(projectId))
    );
    
    if (!containerData) {
      return NextResponse.json({ error: "Container not found" }, { status: 404 });
    }
    
    const container = docker.getContainer(containerData.Id);
    
    // Commit changes
    await commitChanges(container, message || "Manual save from QuantumIDE");
    
    // Push to GitHub if URL provided
    if (repoUrl) {
      await pushToGitHub(container, repoUrl, "main", token || process.env.GITHUB_TOKEN);
      return NextResponse.json({ 
        success: true, 
        message: "Changes committed and pushed to GitHub" 
      });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: "Changes committed locally (no remote configured)" 
    });
  } catch (err: any) {
    console.error(`[Git] Sync failed: ${err.message}`);
    return NextResponse.json(
      { error: `Git sync failed: ${err.message}` },
      { status: 500 }
    );
  }
}

// GET endpoint to check Git status
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  try {
    const containers = await docker.listContainers({ all: true });
    const containerData = containers.find(c => 
      c.Names?.some(name => name.includes(projectId))
    );
    
    if (!containerData) {
      return NextResponse.json({ error: "Container not found" }, { status: 404 });
    }
    
    const container = docker.getContainer(containerData.Id);
    const status = await getGitStatus(container);
    
    return NextResponse.json(status);
  } catch (err: any) {
    console.error(`[Git] Status check failed: ${err.message}`);
    return NextResponse.json(
      { error: `Git status failed: ${err.message}` },
      { status: 500 }
    );
  }
}