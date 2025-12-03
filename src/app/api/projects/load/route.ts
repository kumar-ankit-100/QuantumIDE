// app/api/projects/load/route.ts - Load project from GitHub
import { NextRequest, NextResponse } from "next/server";
import Docker from "dockerode";
import { cloneFromGitHub } from "@/lib/github";
import { createContainer } from "@/lib/containerManager";
import path from "path";
import fs from "fs-extra";
import { v4 as uuidv4 } from "uuid";

const docker = new Docker();
const PROJECTS_DIR = path.join(process.cwd(), "projects");

export async function POST(req: NextRequest) {
  try {
    const { repoUrl, name, token } = await req.json();

    if (!repoUrl) {
      return NextResponse.json({ error: "Missing repoUrl" }, { status: 400 });
    }

    const projectId = uuidv4();
    const projectFolder = path.join(PROJECTS_DIR, projectId);
    
    // Create local folder for metadata
    await fs.ensureDir(projectFolder);

    // Save metadata
    const projectMetadata = {
      id: projectId,
      name: name || `GitHub Project ${projectId.slice(0, 8)}`,
      repoUrl,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    };

    await fs.writeJSON(path.join(projectFolder, "metadata.json"), projectMetadata);

    // Create container
    const container = await createContainer(projectId, projectFolder);
    console.log(`Container created: ${container.id}`);

    // Clone project from GitHub
    await cloneFromGitHub(
      container,
      repoUrl,
      "main",
      token || process.env.GITHUB_TOKEN
    );

    return NextResponse.json({
      projectId,
      containerId: container.id,
      metadata: projectMetadata,
      message: "Project loaded from GitHub successfully",
    });
  } catch (err: any) {
    console.error(`Failed to load project from GitHub: ${err.message}`);
    return NextResponse.json(
      { error: `Failed to load project: ${err.message}` },
      { status: 500 }
    );
  }
}
