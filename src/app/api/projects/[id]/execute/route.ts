import { NextRequest, NextResponse } from "next/server";
import Docker from "dockerode";

const docker = new Docker();

// Store current working directory per project
const projectWorkingDirs = new Map<string, string>();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const { command } = await req.json();
    
    const container = docker.getContainer(projectId);
    
    // Get current working directory for this project (default to /app)
    let currentDir = projectWorkingDirs.get(projectId) || "/app";
    
    // Check if command is a cd command
    const cdMatch = command.match(/^\s*cd\s+(.+?)\s*$/);
    if (cdMatch) {
      const targetDir = cdMatch[1].trim();
      
      // Handle cd with absolute or relative paths
      let newDir: string;
      if (targetDir === '~' || targetDir === '') {
        newDir = '/app';
      } else if (targetDir.startsWith('/')) {
        newDir = targetDir;
      } else if (targetDir === '..') {
        // Go up one directory
        const parts = currentDir.split('/').filter(p => p);
        parts.pop();
        newDir = '/' + parts.join('/') || '/app';
      } else if (targetDir.startsWith('../')) {
        // Handle relative paths like ../something
        const parts = currentDir.split('/').filter(p => p);
        const targetParts = targetDir.split('/');
        for (const part of targetParts) {
          if (part === '..') {
            parts.pop();
          } else if (part !== '.') {
            parts.push(part);
          }
        }
        newDir = '/' + parts.join('/') || '/app';
      } else {
        // Relative path from current directory
        newDir = currentDir === '/' ? `/${targetDir}` : `${currentDir}/${targetDir}`;
      }
      
      // Verify directory exists in container
      const checkExec = await container.exec({
        AttachStdout: true,
        AttachStderr: true,
        Cmd: ["/bin/bash", "-c", `[ -d "${newDir}" ] && echo "exists" || echo "not_found"`],
      });
      
      const checkStream = await checkExec.start({ hijack: false });
      let checkOutput = "";
      
      checkStream.on("data", (data: Buffer) => {
        checkOutput += data.toString();
      });
      
      await new Promise((resolve) => {
        checkStream.on("end", resolve);
        setTimeout(resolve, 1000);
      });
      
      if (checkOutput.includes("exists")) {
        // Update working directory
        projectWorkingDirs.set(projectId, newDir);
        return NextResponse.json({ 
          output: `Changed directory to: ${newDir}\n`,
          workingDir: newDir 
        });
      } else {
        return NextResponse.json({ 
          output: `bash: cd: ${targetDir}: No such file or directory\n`,
          workingDir: currentDir 
        });
      }
    }
    
    // Execute command in current working directory
    const exec = await container.exec({
      AttachStdout: true,
      AttachStderr: true,
      Cmd: ["/bin/bash", "-c", command],
      WorkingDir: currentDir,
    });

    const stream = await exec.start({ hijack: false });
    
    let output = "";
    
    stream.on("data", (data: Buffer) => {
      output += data.toString();
    });
    
    await new Promise((resolve) => {
      stream.on("end", resolve);
      setTimeout(resolve, 3000); // Max 3 second wait for quick commands
    });

    return NextResponse.json({ 
      output,
      workingDir: currentDir 
    });
  } catch (err: any) {
    console.error(`Failed to execute command: ${err.message}`);
    return NextResponse.json(
      { error: `Failed to execute command: ${err.message}` },
      { status: 500 }
    );
  }
}
