import { NextRequest, NextResponse } from "next/server";
import Docker from "dockerode";
import { readFileFromContainer } from "@/lib/containerFileHelpers";

const docker = new Docker();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { filePath } = await req.json();
    const { id: projectId } = await params;

    if (!filePath) {
      return NextResponse.json({ error: "filePath is required" }, { status: 400 });
    }

    const container = docker.getContainer(projectId);
    const content = await readFileFromContainer(container, filePath);

    return NextResponse.json({ content });
  } catch (err: any) {
    console.error(`Failed to read file: ${err.message}`);
    return NextResponse.json(
      { error: `Failed to read file: ${err.message}` },
      { status: 500 }
    );
  }
}
