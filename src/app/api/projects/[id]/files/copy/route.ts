import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getContainerByProjectId, execCommand } from "@/lib/containerFileHelpers";
import { updateContainerActivity } from "@/lib/containerManager";

/**
 * POST /api/projects/:id/files/copy
 * body: { sourcePath: string, targetPath: string, type: 'file' | 'directory' }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json();
    const { sourcePath, targetPath, type } = body as { 
      sourcePath?: string; 
      targetPath?: string;
      type?: string;
    };
    const { id: projectId } = await params;

    if (!projectId) {
      return NextResponse.json({ error: "Missing project id" }, { status: 400 });
    }

    if (!sourcePath || !targetPath) {
      return NextResponse.json({ error: "Missing sourcePath or targetPath" }, { status: 400 });
    }

    const container = await getContainerByProjectId(projectId);
    if (!container) {
      return NextResponse.json({ error: "Container not found" }, { status: 404 });
    }

    const sourceContainerPath = `/app/${sourcePath}`;
    const targetContainerPath = `/app/${targetPath}`;

    // Ensure parent directory of target exists
    const targetDir = targetContainerPath.substring(0, targetContainerPath.lastIndexOf('/'));
    if (targetDir && targetDir !== '/app') {
      await execCommand(container, ["mkdir", "-p", targetDir], "/app");
    }

    // Copy file or directory recursively
    if (type === 'directory') {
      await execCommand(container, ["cp", "-r", sourceContainerPath, targetContainerPath], "/app");
    } else {
      await execCommand(container, ["cp", sourceContainerPath, targetContainerPath], "/app");
    }

    updateContainerActivity(`${projectId}-dev`);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error copying file/folder:", err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
