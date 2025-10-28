

import { NextResponse } from "next/server";
import Docker from "dockerode";
import {  getContainerStatus } from "@/lib/containerManager";

const docker = new Docker();

interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
}

async function buildContainerFileTree(
  container: Docker.Container,
  dirPath: string,
  basePath: string = ""
): Promise<FileNode[]> {
  try {
    // Execute 'ls -la' command to list directory contents
    const exec = await container.exec({
      Cmd: ["ls", "-laR", "--group-directories-first", dirPath],
      AttachStdout: true,
      AttachStderr: true,
    });

    const stream = await exec.start({ Detach: false });
    
    let output = "";
    stream.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });

    await new Promise((resolve) => stream.on("end", resolve));

    // Parse the ls output to build the tree
    return parseLsOutput(output, basePath);
  } catch (error) {
    console.error(`Error reading container directory ${dirPath}:`, error);
    return [];
  }
}

// Alternative approach using tar stream (more reliable)
async function buildContainerFileTreeFromTar(
  container: Docker.Container,
  dirPath: string,
  basePath: string = ""
): Promise<FileNode[]> {
  try {
    // Get directory contents as tar stream
    const tarStream = await container.getArchive({ path: dirPath });
    
    const tar = await import("tar-stream");
    const extract = tar.extract();
    
    const fileMap = new Map<string, FileNode>();
    const rootNodes: FileNode[] = [];

    await new Promise<void>((resolve, reject) => {
      extract.on("entry", (header, stream, next) => {
        const relativePath = header.name.replace(/^\.\//, "");
        
        // Skip node_modules and hidden files
        if (
          relativePath.includes("node_modules/") ||
          relativePath.split("/").some(part => part.startsWith("."))
        ) {
          stream.resume();
          next();
          return;
        }

        const isDirectory = header.type === "directory";
        const pathParts = relativePath.split("/").filter(Boolean);
        const name = pathParts[pathParts.length - 1] || "";

        if (!name) {
          stream.resume();
          next();
          return;
        }

        const node: FileNode = {
          name,
          path: basePath ? `${basePath}/${relativePath}` : relativePath,
          isDirectory,
          children: isDirectory ? [] : undefined,
        };

        fileMap.set(relativePath, node);

        // Determine parent
        if (pathParts.length === 1) {
          rootNodes.push(node);
        } else {
          const parentPath = pathParts.slice(0, -1).join("/");
          const parent = fileMap.get(parentPath);
          if (parent && parent.children) {
            parent.children.push(node);
          }
        }

        stream.resume();
        next();
      });

      extract.on("finish", resolve);
      extract.on("error", reject);
      
      tarStream.pipe(extract);
    });

    return rootNodes;
  } catch (error) {
    console.error(`Error reading container directory ${dirPath}:`, error);
    return [];
  }
}
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
    exec.start({ Tty: false }, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }

      const chunks: Buffer[] = [];

      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      
      stream.on("end", () => {
        const buffer = Buffer.concat(chunks);
        let output = "";
        let offset = 0;
        
        while (offset < buffer.length && offset + 8 <= buffer.length) {
          const size = buffer.readUInt32BE(offset + 4);
          if (offset + 8 + size > buffer.length) break;
          
          output += buffer.slice(offset + 8, offset + 8 + size).toString();
          offset += 8 + size;
        }
        
        resolve(output);
      });

      stream.on("error", reject);
    });
  });
}

// Simple approach using exec with find command
async function buildContainerFileTreeSimple(
  container: Docker.Container,
  dirPath: string,
  basePath: string = ""
): Promise<FileNode[]> {
  try {
    // STEP 1: Execute find command using your execCommand helper
         container = docker.getContainer(container.Id);
         const output = await execCommand(
      container,
      [
        "find",                           // Find files command
        dirPath,                          // Starting directory (e.g., /app)
        "-not", "-path", "*/node_modules/*",  // Exclude node_modules
        "-not", "-path", "*/.*",          // Exclude hidden files (.git, etc)
        "-printf", "%y %p\n"              // Format: "d /path" or "f /path"
      ],
      dirPath  // Working directory
    );
    // const output = await execCommand(container, ["ls", "-la", "/app"], "/app");
    console.log("find output:", output);
    
    // WHY THIS COMMAND:
    // - "find /app" → recursively lists all files/dirs
    // - "-not -path" → filters out unwanted paths
    // - "-printf %y %p\n" → outputs type (d/f) + full path, one per line
    //   Example output:
    //   d /app
    //   d /app/src
    //   f /app/src/index.ts
    //   f /app/package.json

    // STEP 2: Parse the output into FileNode structure
    const lines = output.trim().split("\n").filter(Boolean);
    const fileMap = new Map<string, FileNode>();
    const rootNodes: FileNode[] = [];

    for (const line of lines) {
      // PARSE EACH LINE: "d /app/src" → type='d', fullPath='/app/src'
      const match = line.match(/^([df])\s+(.+)$/);
      if (!match) continue;

      const [, type, fullPath] = match;
      
      // CONVERT TO RELATIVE PATH: "/app/src/index.ts" → "src/index.ts"
      const relativePath = fullPath
        .replace(dirPath, "")      // Remove base directory
        .replace(/^\//, "");        // Remove leading slash
      
      // Skip root directory itself (empty path)
      if (!relativePath) continue;

      // DETERMINE IF DIRECTORY
      const isDirectory = type === "d";  // 'd' = directory, 'f' = file
      
      // EXTRACT NAME FROM PATH: "src/components/Button.tsx" → "Button.tsx"
      const pathParts = relativePath.split("/");
      const name = pathParts[pathParts.length - 1];

      // CREATE FILE NODE
      const node: FileNode = {
        name,           // "Button.tsx"
        path: basePath ? `${basePath}/${relativePath}` : relativePath,
        isDirectory,
        children: isDirectory ? [] : undefined,  // Only dirs have children
      };

      // STORE IN MAP for parent lookup
      fileMap.set(relativePath, node);

      // STEP 3: Build tree hierarchy
      if (pathParts.length === 1) {
        // TOP-LEVEL: add directly to root
        rootNodes.push(node);
      } else {
        // NESTED: find parent and add as child
        const parentPath = pathParts.slice(0, -1).join("/");
        const parent = fileMap.get(parentPath);
        
        if (parent && parent.children) {
          parent.children.push(node);
        }
      }
    }

    return rootNodes;
    
  } catch (error) {
    console.error(`Error reading container directory ${dirPath}:`, error);
    return [];
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const containerId = searchParams.get("containerId");

    if (!containerId) {
      return NextResponse.json(
        { error: "containerId is required" },
        { status: 400 }
      );
    }
    console.log(`[${new Date().toISOString()}] Listing files for container: ${containerId}`);
    const containers = await docker.listContainers({ all: true });
    console.log(`[${new Date().toISOString()}] Existing containers:`, containers.map(c => c.Names));
  const container = containers.find(c =>
    c.Names?.some(name => name.includes(containerId))
  );

    // const container = docker.getContainer(containerId);
    console.log(`[${new Date().toISOString()}] Found container:`, container);
    
    // Check if container exists and is running
    const info = await getContainerStatus(containerId);
    // console.log(`[${new Date().toISOString()}] Container status:`, info);
    if (info !== "running") {
      return NextResponse.json(
        { error: "Container is not running" },
        { status: 400 }
      );
    }

    // Use the working directory from container or default to /app
    const workDir = "/app";

    // Choose your preferred method:
    // 1. Simple approach using find (recommended for most cases)
    const files = await buildContainerFileTreeSimple(container, workDir);
    
    // 2. Tar-based approach (more reliable but slightly slower)
    // const files = await buildContainerFileTreeFromTar(container, workDir);

    return NextResponse.json({ files });
  } catch (err: any) {
    console.error(`[${new Date().toISOString()}] Error listing container files: ${err.message}`);
    return NextResponse.json(
      { error: `Failed to list container files: ${err.message}` },
      { status: 500 }
    );
  }
}