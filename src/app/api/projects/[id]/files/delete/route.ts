import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getContainerByProjectId, execCommand } from "@/lib/containerFileHelpers";
import { updateContainerActivity } from "@/lib/containerManager";

/**
 * POST /api/projects/:id/files/delete
 * body: { path: string, type: 'file' | 'directory' }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json();
    const { path, type } = body as { path?: string; type?: string };
    const { id: projectId } = await params;

    if (!projectId) {
      return NextResponse.json({ error: "Missing project id" }, { status: 400 });
    }

    if (!path) {
      return NextResponse.json({ error: "Missing path" }, { status: 400 });
    }

    const container = await getContainerByProjectId(projectId);
    if (!container) {
      return NextResponse.json({ error: "Container not found" }, { status: 404 });
    }

    const containerPath = `/app/${path}`;

    // Use rm -rf for directories, rm -f for files
    if (type === 'directory') {
      await execCommand(container, ["rm", "-rf", containerPath], "/app");
    } else {
      await execCommand(container, ["rm", "-f", containerPath], "/app");
    }

    updateContainerActivity(`${projectId}-dev`);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting file/folder:", err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
