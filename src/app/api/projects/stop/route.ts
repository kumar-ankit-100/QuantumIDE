import { cleanupContainer } from "@/lib/containerManager";
import { NextRequest, NextResponse } from "next/server";
import Docker from "dockerode";
const docker = new Docker();

export async function POST(req: NextRequest) {
  const { projectId } = await req.json();

  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  try {
    const devContainerName = `${projectId}`;
  
    // Stop dev container
const container = docker.getContainer(devContainerName);
console.log(`Stopping container with name: ${devContainerName} and conainer id: ${container}`);

    // Stop the container
    await container.stop();
    return NextResponse.json({ 
      success: true, 
      message: "Development server stopped" 
    });
  } catch (err: any) {
    console.error(`Failed to stop server: ${err.message}`);
    return NextResponse.json(
      { error: `Failed to stop server: ${err.message}` },
      { status: 500 }
    );
  }
}