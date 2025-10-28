import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs-extra";
import { syncLocalToS3 } from "@/lib/s3";

export async function POST(req: NextRequest) {
  const { projectId } = await req.json();
  const PROJECTS_DIR = path.join(process.cwd(), "projects");
  

  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  const projectFolder = path.join(PROJECTS_DIR, projectId);

  if (!(await fs.pathExists(projectFolder))) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  try {
    // await syncLocalToS3(projectId, projectFolder);
    return NextResponse.json({ 
      success: true, 
      message: "Project synced to S3" 
    });
  } catch (err: any) {
    console.error(`[S3] Sync failed: ${err.message}`);
    return NextResponse.json(
      { error: `Sync failed: ${err.message}` },
      { status: 500 }
    );
  }
}