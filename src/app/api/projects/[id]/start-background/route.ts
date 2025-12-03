import { NextRequest, NextResponse } from 'next/server';
import Docker from 'dockerode';
import path from 'path';
import fs from 'fs-extra';

const docker = new Docker();
const PROJECTS_DIR = path.join(process.cwd(), "projects");

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    let { command } = await request.json();

    // Try to read project metadata to get the correct dev command
    const projectFolder = path.join(PROJECTS_DIR, id);
    const metadataPath = path.join(projectFolder, "metadata.json");
    
    let serverType = "vite"; // default
    
    if (!command && await fs.pathExists(metadataPath)) {
      try {
        const metadata = await fs.readJSON(metadataPath);
        serverType = metadata.serverConfig?.type || "vite";
        
        if (metadata.serverConfig?.devCommand) {
          command = metadata.serverConfig.devCommand;
          console.log(`Using dev command from metadata: ${command}`);
        }
      } catch (err) {
        console.warn('Failed to read metadata, using default command');
      }
    }

    // Default to npm run dev if no command specified
    // Next.js already has -H 0.0.0.0 in package.json, don't add --host
    if (!command) {
      if (serverType === "nextjs") {
        command = "npm run dev";
      } else {
        command = "npm run dev -- --host 0.0.0.0";
      }
    }

    console.log(`Starting background process in container ${id}: ${command}`);

    const container = docker.getContainer(id);

    // Start the command in background using nohup and redirect output
    const backgroundCommand = `nohup ${command} > /tmp/dev-server.log 2>&1 &`;
    
    const exec = await container.exec({
      Cmd: ['sh', '-c', backgroundCommand],
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
      WorkingDir: '/app',
    });

    await exec.start({ Detach: false, Tty: false });

    // Wait a bit for the process to start
    await new Promise(resolve => setTimeout(resolve, 500));

    return NextResponse.json({ 
      success: true,
      message: 'Background process started',
      logFile: '/tmp/dev-server.log',
      command
    });
  } catch (error) {
    console.error('Error starting background process:', error);
    return NextResponse.json(
      { error: 'Failed to start background process', details: String(error) },
      { status: 500 }
    );
  }
}