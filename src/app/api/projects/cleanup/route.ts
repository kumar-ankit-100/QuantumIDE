import { cleanupProject } from "@/lib/containerManager";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

const PROJECTS_DIR = path.join(process.cwd(), "projects");

export async function POST(req: NextRequest) {
  const { projectId, deleteS3Files } = await req.json();

  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  const projectFolder = path.join(PROJECTS_DIR, projectId);

  try {
    // await cleanupProject(projectId, projectFolder, deleteS3Files || false);
    
    return NextResponse.json({ 
      success: true, 
      message: "Project cleaned up successfully" 
    });
  } catch (err: any) {
    console.error(`Cleanup failed: ${err.message}`);
    return NextResponse.json(
      { error: `Cleanup failed: ${err.message}` },
      { status: 500 }
    );
  }
}
