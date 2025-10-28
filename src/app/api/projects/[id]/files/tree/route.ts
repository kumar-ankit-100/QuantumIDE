import { NextRequest, NextResponse } from "next/server";
import Docker from "dockerode";
import { getContainerFileTree } from "@/lib/containerManager";

const docker = new Docker();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const container = docker.getContainer(projectId);
    
    const tree = await getContainerFileTree(container);

    return NextResponse.json({ tree });
  } catch (err: any) {
    console.error(`Failed to get file tree: ${err.message}`);
    return NextResponse.json(
      { error: `Failed to get file tree: ${err.message}` },
      { status: 500 }
    );
  }
}
