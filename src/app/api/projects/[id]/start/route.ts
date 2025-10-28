import { NextRequest, NextResponse } from "next/server";
import Docker from "dockerode";
import { startDevServer } from "@/lib/containerManager";

const docker = new Docker();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const container = docker.getContainer(projectId);
    
    const { hostPort } = await startDevServer(container);

    return NextResponse.json({ 
      message: "Dev server started",
      hostPort,
      previewUrl: `http://localhost:${hostPort}`
    });
  } catch (err: any) {
    console.error(`Failed to start dev server: ${err.message}`);
    return NextResponse.json(
      { error: `Failed to start dev server: ${err.message}` },
      { status: 500 }
    );
  }
}
