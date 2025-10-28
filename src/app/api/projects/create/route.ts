// app/api/projects/create/route.ts - Cloud IDE version (container-only storage)
import { NextResponse } from "next/server";
import path from "path";
import fs from "fs-extra";
import { v4 as uuidv4 } from "uuid";
import { uploadDirectoryToS3 } from "@/lib/s3";
import {
  createContainer,
  createViteProject,
  stopAndRemoveContainer,
  verifyContainerFiles,
  listContainerFiles,
} from "@/lib/containerManager";

const PROJECTS_DIR = path.join(process.cwd(), "projects");

export async function POST() {
  const startTime = Date.now();
  let container = null;

  try {
    const projectId = uuidv4();
    const projectFolder = path.join(PROJECTS_DIR, projectId);
    
    // Create local folder for metadata/tracking only (not for project files)
    await fs.ensureDir(projectFolder);

    // Create container - files live INSIDE container only
    container = await createContainer(projectId, projectFolder);
    await createViteProject(container);

    // Verify files exist INSIDE container (not on host)
    const filesExist = await verifyContainerFiles(container);
    if (!filesExist) {
      throw new Error("No files generated inside container");
    }

    // Get file list from inside container
    const containerFiles = await listContainerFiles(container);
    console.log(`[${new Date().toISOString()}] Files inside container:`, containerFiles);

    // // Upload to S3 (async, don't block response)
    // uploadDirectoryToS3(projectId, projectFolder).catch(err => {
    //   console.error(`[S3] Background upload failed: ${err.message}`);
    // });
    console.log(`Container created with id: ${container.id}`);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    return NextResponse.json({
      projectId,
      containerId: container.id,
      files: containerFiles,
      message: "Project created successfully inside container",
      duration: `${duration}s`,
      note: "Files are stored inside container at /app. Use GitHub for persistence."
    });
  } catch (err: any) {
    console.error(`Failed to create project: ${err.message}`);
    return NextResponse.json(
      { error: `Failed to create project: ${err.message}` },
      { status: 500 }
    );
  }
}