import { NextRequest, NextResponse } from 'next/server';
import { execCommand } from '@/lib/containerManager';
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
    const { processName } = await request.json();

    console.log(`Killing process ${processName} in container ${id}`);

    const container = docker.getContainer(id);
    
    // Kill the process by name (|| true makes it not fail if process doesn't exist)
    const killCommand = ['sh', '-c', `pkill -f "${processName}" || true`];
    const output = await execCommand(container, killCommand);

    return NextResponse.json({ 
      success: true, 
      output,
      message: `Process ${processName} killed successfully` 
    });
  } catch (error) {
    console.error('Error killing process:', error);
    return NextResponse.json(
      { error: 'Failed to kill process', details: String(error) },
      { status: 500 }
    );
  }
}
