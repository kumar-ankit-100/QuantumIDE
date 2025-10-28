import Docker from "dockerode";
import path from "path";
import fs from "fs-extra";
import { syncLocalToS3, deleteProjectFromS3 } from "./s3";
import getPort from "get-port";



const docker = new Docker();
const COMMAND_TIMEOUT = 120000;

// Store active containers and their cleanup handlers
const activeContainers = new Map<string, {
  container: Docker.Container;
  type: "build" | "dev";
  lastActivity: Date;
}>();

export interface ContainerInfo {
  containerId: string;
  projectId: string;
  status: string;
  type: "build" | "dev";
}

/**
 * Create and start a container for a project
 */
export async function createContainer(
  projectId: string,
  projectFolder: string
): Promise<Docker.Container> {
  console.log(`[${new Date().toISOString()}] Creating container for project: ${projectId}`);

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
  }

  // Clean up any existing container
  await cleanupContainer(projectId);

  // Create container with port binding for a range of ports (5173-5180)
  // This allows Vite to use alternative ports if 5173 is in use
  const basePort = 5173;
  const portCount = 8; // Support ports 5173-5180
  const hostPorts: { [key: string]: any } = {};
  const exposedPorts: { [key: string]: {} } = {};
  
  for (let i = 0; i < portCount; i++) {
    const internalPort = basePort + i;
    const hostPort = await getPort({ port: internalPort });
    exposedPorts[`${internalPort}/tcp`] = {};
    hostPorts[`${internalPort}/tcp`] = [{ HostPort: hostPort.toString() }];
    console.log(`Mapping container port ${internalPort} -> host port ${hostPort}`);
  }
  
  // Container has NO bind mounts - files live inside container only
  const container = await docker.createContainer({
    Image: "node:20",
    name: projectId,
    Tty: true,
    WorkingDir: "/app",
    ExposedPorts: exposedPorts,
    HostConfig: {
      Memory: 1024 * 1024 * 1024,
      NanoCpus: 1000000000,
      PortBindings: hostPorts,
      // No Binds - files are container-only, persisted via GitHub
    },
    Env: ["NODE_ENV=development"],
  });

  await container.start();
  
  // Track container
  activeContainers.set(projectId, {
    container,
    type: "build",
    lastActivity: new Date(),
  });
  

  console.log(`[${new Date().toISOString()}] Container started: ${projectId}`);
  return container;
}

/**
 * Start development server with file watching
 */
export async function startDevServer(
  container: Docker.Container,
  port: number = 5173
): Promise<{ container: Docker.Container; hostPort: number }> {
  const projectId = container.id;
  console.log(`[${new Date().toISOString()}] Starting dev server for: ${projectId}`);

  // Get container info
  const info = await container.inspect().catch(() => null);

  if (!info) {
    throw new Error(`Container not found: ${projectId}. You must create it first.`);
  }

  // If container is not running, start it
  if (!info.State.Running) {
    console.log(`[${new Date().toISOString()}] Container exists but not running, starting...`);
    await container.start();
  }

  // Get the host port from container
  const hostPort = await getContainerPort(projectId, port);
  
  if (!hostPort) {
    throw new Error(`No port mapping found for container ${projectId}. Port ${port} should be mapped.`);
  }

  // Start dev server inside container using exec
  console.log(`[${new Date().toISOString()}] Running: npm run dev inside container...`);

  const exec = await container.exec({
    Cmd: ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", port.toString()],
    AttachStdout: true,
    AttachStderr: true,
    WorkingDir: "/app",
  });

  // Start and attach output (optional but useful for logs)
  const stream = await exec.start({ Tty: false });
  if (stream) {
    container.modem.demuxStream(stream, process.stdout, process.stderr);
  }

  console.log(`[${new Date().toISOString()}] Dev server started on host port ${hostPort}`);

  // Track container in your map
  activeContainers.set(projectId, {
    container,
    type: "dev",
    lastActivity: new Date(),
  });

  return { container, hostPort };
}


/**
 * Create React/Vite project in container
 */
export async function createViteProject(container: Docker.Container): Promise<void> {
  console.log(`[${new Date().toISOString()}] Creating Vite React project...`);

  // Create project directly in /app (container filesystem only, no bind mounts)
  await execCommand(
    container,
    ["bash", "-c", "npx create-vite@latest . --template react"],
    "/app"
  );

  console.log(`[${new Date().toISOString()}] Installing dependencies...`);
  await execCommand(container, ["npm", "install"], "/app");

  console.log(`[${new Date().toISOString()}] Project setup complete (inside container at /app)`);
}

/**
 * Verify files exist inside container (for cloud IDE architecture)
 */
export async function verifyContainerFiles(container: Docker.Container): Promise<boolean> {
  try {
    const output = await execCommand(container, ["ls", "-la", "/app"], "/app");
    // Check for package.json and vite.config - key indicators of successful setup
    return output.includes("package.json") && output.includes("vite.config");
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Failed to verify container files:`, err);
    return false;
  }
}

/**
 * Get list of files inside container /app
 */
export async function listContainerFiles(container: Docker.Container): Promise<string[]> {
  try {
    const output = await execCommand(container, ["ls", "-1", "/app"], "/app");
    return output.split("\n").filter(line => line.trim().length > 0);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Failed to list container files:`, err);
    return [];
  }
}

/**
 * Read file content from container
 */
export async function readFileFromContainer(
  container: Docker.Container,
  filePath: string
): Promise<string> {
  try {
    const fullPath = filePath.startsWith('/') ? filePath : `/app/${filePath}`;
    const output = await execCommand(container, ["cat", fullPath], "/app");
    return output;
  } catch (err: any) {
    throw new Error(`Failed to read file ${filePath}: ${err.message}`);
  }
}

/**
 * Write file content to container
 */
export async function writeFileToContainer(
  container: Docker.Container,
  filePath: string,
  content: string
): Promise<void> {
  try {
    const fullPath = filePath.startsWith('/') ? filePath : `/app/${filePath}`;
    // Use bash to write content (escape single quotes in content)
    const escapedContent = content.replace(/'/g, "'\\''");
    await execCommand(
      container,
      ["bash", "-c", `echo '${escapedContent}' > ${fullPath}`],
      "/app"
    );
  } catch (err: any) {
    throw new Error(`Failed to write file ${filePath}: ${err.message}`);
  }
}

/**
 * Get file tree from container
 */
export async function getContainerFileTree(
  container: Docker.Container,
  directory: string = "/app"
): Promise<any> {
  try {
    // Use find to get recursive file listing with type
    const output = await execCommand(
      container,
      ["find", directory, "-maxdepth", "3", "-type", "f", "-o", "-type", "d"],
      directory
    );
    
    const lines = output.split("\n").filter(line => line.trim().length > 0);
    const rootNode: any = { name: "app", type: "directory", path: "/app", children: [] };
    
    // Build file tree structure
    const pathMap = new Map<string, any>();
    pathMap.set(directory, rootNode);
    
    for (const fullPath of lines) {
      if (fullPath === directory) continue;
      
      const relativePath = fullPath.replace(directory + "/", "");
      const parts = relativePath.split("/");
      const fileName = parts[parts.length - 1];
      
      // Skip node_modules and hidden files
      if (relativePath.includes("node_modules") || fileName.startsWith(".")) {
        continue;
      }
      
      // Determine if it's a directory by checking if it has children in the list
      const isDirectory = lines.some(p => p.startsWith(fullPath + "/"));
      
      const node: any = {
        name: fileName,
        type: isDirectory ? "directory" : "file",
        path: relativePath,
        children: isDirectory ? [] : undefined,
      };
      
      // Find parent directory
      let parentPath = directory;
      if (parts.length > 1) {
        parentPath = directory + "/" + parts.slice(0, -1).join("/");
      }
      
      const parent = pathMap.get(parentPath);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(node);
      }
      
      pathMap.set(fullPath, node);
    }
    
    return rootNode;
  } catch (err: any) {
    console.error(`[${new Date().toISOString()}] Failed to get file tree:`, err);
    return { name: "app", type: "directory", path: "/app", children: [] };
  }
}

/**
 * Get exposed port mapping for container
 */
export async function getContainerPort(
  containerId: string,
  internalPort: number = 5173
): Promise<number | null> {
  try {
    const container = docker.getContainer(containerId);
    const info = await container.inspect();
    
    const portKey = `${internalPort}/tcp`;
    const portBindings = info.NetworkSettings?.Ports?.[portKey];
    
    if (portBindings && portBindings.length > 0) {
      return parseInt(portBindings[0].HostPort, 10);
    }
    
    return null;
  } catch (err: any) {
    console.error(`[${new Date().toISOString()}] Failed to get container port:`, err);
    return null;
  }
}

/**
 * Execute command in container
 */
export async function execCommand(
  container: Docker.Container,
  command: string[],
  workingDir: string = "/app"
): Promise<string> {
  console.log(`[${new Date().toISOString()}] Executing: ${command.join(" ")}`);

  const exec = await container.exec({
    Cmd: command,
    AttachStdout: true,
    AttachStderr: true,
    Tty: false,
    WorkingDir: workingDir,
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Command timed out after ${COMMAND_TIMEOUT / 1000}s`));
    }, COMMAND_TIMEOUT);

    exec.start({ Tty: false }).then((stream) => {
      let output = "";
      
      const stdout = {
        write: (data: Buffer) => { output += data.toString(); },
      } as any;
      
      const stderr = {
        write: (data: Buffer) => { output += data.toString(); },
      } as any;
      
      container.modem.demuxStream(stream, stdout, stderr);

      stream.on("close", () => {
        clearTimeout(timeout);
        resolve(output);
      });
      
      stream.on("error", (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      });
    }).catch((err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/**
 * Stop container and sync to S3
 */
export async function stopAndRemoveContainer(container: Docker.Container): Promise<void> {
  try {
    await container.stop({ t: 10 });
  } catch (err: any) {
    console.warn(`Warning: ${err.message}`);
  }

  try {
    await container.remove({ force: true });
  } catch (err: any) {
    console.warn(`Warning: ${err.message}`);
  }
}

/**
 * Cleanup container and sync to S3
 */
export async function cleanupContainer(containerName: string): Promise<void> {
  const allContainers = await docker.listContainers({ all: true });
  const existing = allContainers.find(c =>
    c.Names.some(name => name === `/${containerName}`)
  );
  
  if (existing) {
    const container = docker.getContainer(existing.Id);
    await stopAndRemoveContainer(container);
  }

  activeContainers.delete(containerName);
}

/**
 * Cleanup project completely (container + S3)
 */
export async function cleanupProject(
  projectId: string,
  projectFolder: string,
  deleteS3Files: boolean = false
): Promise<void> {
  console.log(`[${new Date().toISOString()}] Cleaning up project: ${projectId}`);

  // Sync final changes to S3
  try {
    await syncLocalToS3(projectId, projectFolder);
  } catch (err: any) {
    console.error(`[S3] Sync failed during cleanup: ${err.message}`);
  }

  // Cleanup build container
  await cleanupContainer(projectId);
  
  // Cleanup dev container
  await cleanupContainer(`${projectId}-dev`);

}

/**
 * Get container status
 */
export async function getContainerStatus(containerName: string): Promise<string | null> {
  const containers = await docker.listContainers({ all: true });
  const container = containers.find(c =>
    c.Names?.some(name => name.includes(containerName))
  );
  
//   console.log(`[${new Date().toISOString()}] Queried status for container:`, container?.Names);

  return container ? container.State : null;
}


/**
 * List all active project containers
 */
export async function listProjectContainers(): Promise<ContainerInfo[]> {
  const containers = await docker.listContainers({ all: true });
  
  return containers.map(c => ({
    containerId: c.Id,
    projectId: c.Names[0]?.replace("/", "") || "unknown",
    status: c.State,
    type: c.Names[0]?.includes("-dev") ? "dev" : "build",
  }));
}

/**
 * Update container activity timestamp
 */
export function updateContainerActivity(containerName: string): void {
  const info = activeContainers.get(containerName);
  if (info) {
    info.lastActivity = new Date();
  }
}

/**
 * Auto-cleanup inactive containers (run periodically)
 */
export async function cleanupInactiveContainers(maxIdleMinutes: number = 30): Promise<void> {
  const now = new Date();
  
  for (const [name, info] of activeContainers.entries()) {
    const idleMinutes = (now.getTime() - info.lastActivity.getTime()) / (1000 * 60);
    
    if (idleMinutes > maxIdleMinutes) {
      console.log(`[${new Date().toISOString()}] Cleaning up inactive container: ${name}`);
      await cleanupContainer(name);
    }
  }
}