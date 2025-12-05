import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getContainerByProjectId, execCommand } from "@/lib/containerFileHelpers";
import { updateContainerActivity } from "@/lib/containerManager";

/**
 * POST /api/projects/:id/files/rename
 * body: { oldPath: string, newPath: string }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json();
    const { oldPath, newPath } = body as { oldPath?: string; newPath?: string };
    const { id: projectId } = await params;

    if (!projectId) {
      return NextResponse.json({ error: "Missing project id" }, { status: 400 });
    }

    if (!oldPath || !newPath) {
      return NextResponse.json({ error: "Missing oldPath or newPath" }, { status: 400 });
    }

    const container = await getContainerByProjectId(projectId);
    if (!container) {
      return NextResponse.json({ error: "Container not found" }, { status: 404 });
    }

    const oldContainerPath = `/app/${oldPath}`;
    const newContainerPath = `/app/${newPath}`;

    // Ensure parent directory of new path exists
    const newDir = newContainerPath.substring(0, newContainerPath.lastIndexOf('/'));
    if (newDir && newDir !== '/app') {
      await execCommand(container, ["mkdir", "-p", newDir], "/app");
    }

    // Move/rename the file or directory
    await execCommand(container, ["mv", oldContainerPath, newContainerPath], "/app");

    updateContainerActivity(`${projectId}-dev`);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error renaming file/folder:", err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
