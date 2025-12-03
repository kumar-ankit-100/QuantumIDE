import { NextResponse } from "next/server";
import path from "path";
import fs from "fs-extra";
import { getContainerStatus } from "@/lib/containerManager";

const PROJECTS_DIR = path.join(process.cwd(), "projects");

export async function GET() {
  try {
    // Check if projects directory exists
    if (!await fs.pathExists(PROJECTS_DIR)) {
      return NextResponse.json({ projects: [] });
    }

    const projectDirs = await fs.readdir(PROJECTS_DIR);
    const projects = [];

    for (const projectId of projectDirs) {
      const projectFolder = path.join(PROJECTS_DIR, projectId);
      const metadataPath = path.join(projectFolder, "metadata.json");
      
      try {
        if (await fs.pathExists(metadataPath)) {
          const metadata = await fs.readJSON(metadataPath);
          
          // Get container status
          const containerStatus = await getContainerStatus(projectId);
          const status = containerStatus === "running" ? "running" : 
                        containerStatus === "exited" ? "stopped" : "error";

          projects.push({
            id: projectId,
            name: metadata.name || `Project ${projectId.slice(0, 8)}`,
            description: metadata.description || "No description",
            techStack: metadata.techStack || ["React", "Vite"],
            template: metadata.template || "react-vite",
            createdAt: metadata.createdAt,
            lastModified: metadata.lastModified,
            status,
            containerPort: 5173 // Default port, could be dynamic
          });
        }
      } catch (err) {
        console.error(`Failed to read metadata for project ${projectId}:`, err);
        // Add project with minimal info if metadata is corrupted
        projects.push({
          id: projectId,
          name: `Project ${projectId.slice(0, 8)}`,
          description: "No description",
          techStack: ["Unknown"],
          template: "unknown",
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          status: "error"
        });
      }
    }

    // Sort by last modified (newest first)
    projects.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

    return NextResponse.json({ projects });
  } catch (err: any) {
    console.error("Failed to list projects:", err);
    return NextResponse.json(
      { error: `Failed to list projects: ${err.message}` },
      { status: 500 }
    );
  }
}