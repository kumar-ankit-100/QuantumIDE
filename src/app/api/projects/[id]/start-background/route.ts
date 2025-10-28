import { NextRequest, NextResponse } from 'next/server';
import Docker from 'dockerode';

const docker = new Docker();

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
    const { command } = await request.json();

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
      logFile: '/tmp/dev-server.log'
    });
  } catch (error) {
    console.error('Error starting background process:', error);
    return NextResponse.json(
      { error: 'Failed to start background process', details: String(error) },
      { status: 500 }
    );
  }
}
