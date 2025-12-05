import { NextRequest, NextResponse } from "next/server";
import Docker from "dockerode";
import { writeFileToContainer } from "@/lib/containerFileHelpers";

const docker = new Docker();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { filePath, content } = await req.json();
    const { id: projectId } = await params;

    if (!filePath || content === undefined) {
      return NextResponse.json(
        { error: "filePath and content are required" },
        { status: 400 }
      );
    }

    // Use the base64-based write function which handles special characters properly
    await writeFileToContainer(projectId, filePath, content);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error(`Failed to write file: ${err.message}`);
    return NextResponse.json(
      { error: `Failed to write file: ${err.message}` },
      { status: 500 }
    );
  }
}
