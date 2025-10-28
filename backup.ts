import { NextResponse } from "next/server";
import Docker from "dockerode";
import path from "path";
import fs from "fs-extra";
import { v4 as uuidv4 } from "uuid";

const docker = new Docker();

// Directory to store project files (relative to Next.js project root)
const PROJECTS_DIR = path.join(process.cwd(), "projects");

// Timeout for commands (in milliseconds)
const COMMAND_TIMEOUT = 120000; // 120 seconds to account for npm install

export async function POST() {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Starting project creation...`);

  try {
    // Generate unique project ID
    const projectId = uuidv4();
    const projectFolder = path.join(PROJECTS_DIR, projectId);
    console.log(`[${new Date().toISOString()}] Project ID: ${projectId}`);
    console.log(`[${new Date().toISOString()}] Project folder: ${projectFolder}`);

    // Ensure project folder exists on host
    console.log(`[${new Date().toISOString()}] Creating project folder...`);
    await fs.ensureDir(projectFolder);
    console.log(`[${new Date().toISOString()}] Project folder created`);

    // Check if node:20 image exists, pull if not
    console.log(`[${new Date().toISOString()}] Checking for node:20 image...`);
    const images = await docker.listImages();
    const imageExists = images.some(img => img.RepoTags?.includes("node:20"));
    if (!imageExists) {
      console.log(`[${new Date().toISOString()}] Pulling node:20 image...`);
      const stream = await docker.pull("node:20");
      await new Promise((resolve, reject) => {
        docker.modem.followProgress(stream, (err) => {
          if (err) reject(err);
          else resolve(true);
        });
      });
      console.log(`[${new Date().toISOString()}] node:20 image pulled`);
    } else {
      console.log(`[${new Date().toISOString()}] node:20 image already exists`);
    }

    // Remove existing container if any
    console.log(`[${new Date().toISOString()}] Checking for existing container...`);
    const allContainers = await docker.listContainers({ all: true });
    const existing = allContainers.find(c =>
      c.Names.some(name => name === `/${projectId}`)
    );
    if (existing) {
      console.log(`[${new Date().toISOString()}] Removing existing container ${existing.Id}...`);
      const existingContainer = docker.getContainer(existing.Id);
      await existingContainer.remove({ force: true });
      console.log(`[${new Date().toISOString()}] Existing container removed`);
    }

    // Create container with host folder mounted
    console.log(`[${new Date().toISOString()}] Creating Docker container...`);
    const container = await docker.createContainer({
      Image: "node:20",
      name: projectId,
      Tty: true,
      WorkingDir: "/app",
      HostConfig: {
        Binds: [`${projectFolder}:/app/project-files`], // Mount host folder
      },
    });
    console.log(`[${new Date().toISOString()}] Container created: ${projectId}`);

    // Start container
    console.log(`[${new Date().toISOString()}] Starting container...`);
    await container.start();
    console.log(`[${new Date().toISOString()}] Container started`);

    // Exec npx create-vite with piped input to bypass prompts
    console.log(`[${new Date().toISOString()}] Running npx create-vite...`);
    const createVite = await container.exec({
      Cmd: ["bash", "-c", "echo 'n\ny' | npx create-vite@latest my-react-app --template react"],
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
      WorkingDir: "/app",
    });
    console.log(`react vite creation command exec created`);
await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => {
    reject(new Error("Vite command timed out after 120 seconds"));
  }, COMMAND_TIMEOUT);

  createVite.start((err, stream) => {
    if (err) {
      clearTimeout(timeout);
      reject(err);
      return;
    }

    let output = "";
    docker.modem.demuxStream(
      stream,
      (data) => {
        output += data.toString();
        console.log(`[${new Date().toISOString()}] Vite stdout: ${data.toString().trim()}`);
      },
      (data) => {
        output += data.toString();
        console.error(`[${new Date().toISOString()}] Vite stderr: ${data.toString().trim()}`);
      }
    );

    // ✅ USE 'close' INSTEAD OF 'end'
    stream.on("close", () => {
      clearTimeout(timeout);
      console.log(`[${new Date().toISOString()}] Vite command completed`);
      if (output.includes("Ok to proceed?") || output.includes("Use rolldown-vite?")) {
        reject(new Error("Vite command prompted for input despite piped input"));
        return;
      }
      resolve(true);
    });
  });
});
console.log(`[${new Date().toISOString()}] Vite project created`);


 
await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => {
    reject(new Error("npm install timed out after 120 seconds"));
  }, COMMAND_TIMEOUT);

  createVite.start((err, stream) => {
    if (err) {
      clearTimeout(timeout);
      reject(err);
      return;
    }

    docker.modem.demuxStream(stream,
      (data) => console.log(`[${new Date().toISOString()}] npm install stdout: ${data.toString().trim()}`),
      (data) => console.error(`[${new Date().toISOString()}] npm install stderr: ${data.toString().trim()}`)
    );

    stream.on("close", () => {   // ✅ use 'close' not 'end'
      clearTimeout(timeout);
      console.log(`[${new Date().toISOString()}] npm install completed`);
      resolve(true);
    });
  });
});
console.log(`[${new Date().toISOString()}] Dependencies installed`);

    // Copy files to mounted directory
    console.log(`[${new Date().toISOString()}] Copying project files...`);
    const copyFiles = await container.exec({
      Cmd: ["cp", "-r", "/app/my-react-app/.", "/app/project-files/"],
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
    });
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("File copy timed out after 120 seconds"));
      }, COMMAND_TIMEOUT);
      copyFiles.start((err, stream) => {
        if (err) {
          clearTimeout(timeout);
          reject(err);
        }
        docker.modem.demuxStream(stream, 
          (data) => console.log(`[${new Date().toISOString()}] Copy stdout: ${data.toString().trim()}`),
          (data) => console.error(`[${new Date().toISOString()}] Copy stderr: ${data.toString().trim()}`)
        );
        stream.on("end", () => {
          clearTimeout(timeout);
          console.log(`[${new Date().toISOString()}] File copy completed`);
          resolve(true);
        });
      });
    });
    console.log(`[${new Date().toISOString()}] Project files copied`);

    // Stop and remove container
    console.log(`[${new Date().toISOString()}] Stopping container...`);
    try {
      await container.stop();
      console.log(`[${new Date().toISOString()}] Container stopped`);
    } catch (stopErr) {
      console.warn(`[${new Date().toISOString()}] Warning: Failed to stop container: ${stopErr.message}`);
    }
    console.log(`[${new Date().toISOString()}] Removing container...`);
    try {
      await container.remove();
      console.log(`[${new Date().toISOString()}] Container removed`);
    } catch (removeErr) {
      console.warn(`[${new Date().toISOString()}] Warning: Failed to remove container: ${removeErr.message}`);
    }

    // Verify project files were created
    console.log(`[${new Date().toISOString()}] Verifying project files...`);
    const files = await fs.readdir(projectFolder);
    console.log(`[${new Date().toISOString()}] Files found: ${files.join(", ")}`);
    if (!files.length) {
      throw new Error("No files generated in Docker container");
    }

    const endTime = Date.now();
    console.log(`[${new Date().toISOString()}] Project creation completed in ${(endTime - startTime) / 1000} seconds`);

    // Return project ID
    return NextResponse.json({ projectId });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Failed to create project: ${err.message}`);
    return NextResponse.json(
      { error: `Failed to create project: ${err.message}` },
      { status: 500 }
    );
  }
}