// app/api/projects/create/route.ts - Cloud IDE version (container-only storage)
import { NextResponse } from "next/server";
import path from "path";
import fs from "fs-extra";
import { v4 as uuidv4 } from "uuid";
import {
  createContainer,
  createViteProject,
  createNextJSProject,
  createNodeExpressProject,
  createVanillaJSProject,
  stopAndRemoveContainer,
  verifyContainerFiles,
  listContainerFiles,
} from "@/lib/containerManager";
import { execCommand } from "@/lib/containerFileHelpers";
import { withErrorHandler } from "@/middleware/withErrorHandler";
import { withRateLimit } from "@/middleware/withRateLimit";
import { logger } from "@/lib/logger";
import { timeAsync } from "@/lib/metrics";

const PROJECTS_DIR = path.join(process.cwd(), "projects");

async function createProjectHandler(request: Request) {
  const startTime = Date.now();
  let container = null;
  let projectName = "";

  try {
    // Parse request body for project configuration
    const body = await request.json().catch(() => ({}));
    const { 
      template = "react-vite", 
      name = "", 
      description = "", 
      techStack = [] 
    } = body;

    projectName = name;
    const projectId = uuidv4();
    logger.info("Creating project", { projectId, template, name });

    // Save project metadata (will be stored in container and synced to GitHub)
    const projectMetadata = {
      id: projectId,
      name: name || `Project ${projectId.slice(0, 8)}`,
      description: description || "No description",
      template,
      techStack,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      githubRepo: "", // Will be set when user connects to GitHub
      serverConfig: {
        type: template === "nextjs" || template === "fullstack-nextjs" ? "nextjs" : 
              template === "react-vite" ? "vite" : 
              template === "node-express" ? "express" : 
              template === "vanilla-js" ? "vite" : "vite",
        defaultPort: template === "nextjs" || template === "fullstack-nextjs" ? 3000 : 5173,
        devCommand: template === "nextjs" || template === "fullstack-nextjs" ? "npm run dev" : 
                    template === "node-express" ? "npm run dev" : 
                    "npm run dev -- --host 0.0.0.0"
      }
    };

    // Create container - files live INSIDE container only (no local folders)
    container = await createContainer(projectId, projectMetadata);
    
    // Create project based on template
    switch (template) {
      case "nextjs":
      case "fullstack-nextjs":
        await createNextJSProject(container);
        break;
      case "node-express":
        await createNodeExpressProject(container);
        break;
      case "vanilla-js":
        await createVanillaJSProject(container);
        break;
      case "python-fastapi":
        // TODO: Add Python FastAPI template
        await createViteProject(container); // Fallback for now
        break;
      default:
        await createViteProject(container);
    }

    // Wait a moment for file system to settle
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Verify files exist INSIDE container (not on host)
    const filesExist = await verifyContainerFiles(container);
    
    // Get file list from inside container
    const containerFiles = await listContainerFiles(container);
    console.log(`[${new Date().toISOString()}] Files inside container:`, containerFiles);
    
    if (!filesExist) {
      logger.warn("File verification failed", { containerFiles });
      throw new Error(`No files generated inside container. Found: ${containerFiles.join(', ')}`);
    }

    console.log(`Container created with id: ${container.id}`);

    // Initialize Git repository
    try {
      const { initGitInContainer, pushToGitHub } = await import("@/lib/github");
      await initGitInContainer(container, projectId);
      console.log(`[Git] Repository initialized`);
      
      // Auto-create GitHub repo if requested and token available
      const githubToken = process.env.GITHUB_TOKEN || body.githubToken;
      if (githubToken && body.createGithubRepo) {
        try {
          const { createGitHubRepo } = await import("@/lib/githubAPI");
          const repo = await createGitHubRepo({
            name: projectMetadata.name.toLowerCase().replace(/\s+/g, '-'),
            description: projectMetadata.description,
            private: body.privateRepo ?? true,
            token: githubToken,
          });
          
          console.log(`[GitHub] Repo created: ${repo.fullName}`);
          
          // Push initial commit to GitHub
          await pushToGitHub(
            container,
            repo.cloneUrl.replace('https://', `https://${githubToken}@`),
            githubToken
          );
          
          // Update metadata with GitHub repo info
          projectMetadata.githubRepo = repo.cloneUrl;
          await execCommand(
            container,
            ["bash", "-c", `echo '${JSON.stringify(projectMetadata, null, 2).replace(/'/g, "'\\''")}' > /app/.quantumide-metadata.json`],
            "/app"
          );
          
          console.log(`[GitHub] Pushed to ${repo.fullName}`);
        } catch (ghErr: any) {
          console.warn(`[GitHub] Auto-create failed: ${ghErr.message}`);
        }
      }
    } catch (err: any) {
      console.warn(`[Git] Init failed: ${err.message}`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    return NextResponse.json({
      projectId,
      containerId: container.id,
      files: containerFiles,
      metadata: projectMetadata,
      message: "Project created successfully inside container",
      duration: `${duration}s`,
      githubRepo: projectMetadata.githubRepo || null,
      note: "Files are stored inside container only. Auto-synced to GitHub when configured."
    });
  } catch (err: any) {
    logger.error("Failed to create project", err, { projectName });
    
    // Clean up container if it was created
    if (container) {
      try {
        await stopAndRemoveContainer(container);
      } catch (cleanupErr) {
        logger.error("Failed to cleanup container after error", cleanupErr as Error);
      }
    }
    
    return NextResponse.json(
      { error: `Failed to create project: ${err.message}` },
      { status: 500 }
    );
  }
}

export const POST = withErrorHandler(
  withRateLimit(createProjectHandler, {
    interval: 60 * 60 * 1000, // 1 hour
    maxRequests: 10, // 10 project creations per hour per user
  })
);