import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getContainerByProjectId,
  createDirectoryInContainer,
  writeFileToContainer,
} from "@/lib/containerFileHelpers";
import { updateContainerActivity } from "@/lib/containerManager";

/**
 * POST /api/projects/:id/files/create
 * body: { path: string, type: 'file' | 'folder' }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json();
    const { path, type } = body as { path?: string; type?: string };
    const { id: projectId } = await params;

    if (!projectId) {
      return NextResponse.json({ error: "Missing project id" }, { status: 400 });
    }

    if (!path || !type) {
      return NextResponse.json({ error: "Missing path or type" }, { status: 400 });
    }

    const container = await getContainerByProjectId(projectId);
    if (!container) {
      return NextResponse.json({ error: "Container not found" }, { status: 404 });
    }

    // Normalize to container paths under /app
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const containerPath = `/app${normalizedPath}`;

    if (type === "folder") {
      // Create directory (mkdir -p)
      await createDirectoryInContainer(container, containerPath);
      updateContainerActivity(`${projectId}-dev`);
      return NextResponse.json({ success: true, created: "folder" });
    }

    // For files: ensure parent directory exists, then create empty file
    const parentDir = containerPath.substring(0, containerPath.lastIndexOf('/')) || '/app';
    if (parentDir) {
      await createDirectoryInContainer(container, parentDir);
    }

    // Use safe write helper with empty content to create file
    await writeFileToContainer(container.id || (container as any), containerPath, "");
    updateContainerActivity(`${projectId}-dev`);

    return NextResponse.json({ success: true, created: "file" });
  } catch (err: any) {
    console.error("Error creating file/folder:", err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
