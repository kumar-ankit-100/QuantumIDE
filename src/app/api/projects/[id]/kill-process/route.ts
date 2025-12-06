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
    
    // Check if container exists
    try {
      await container.inspect();
    } catch (err: any) {
      if (err.statusCode === 404) {
        return NextResponse.json({ 
          success: false,
          error: 'Container not found',
          message: 'The project container no longer exists. Please restart the project.' 
        }, { status: 404 });
      }
      throw err;
    }
    
    // Kill the process by name (|| true makes it not fail if process doesn't exist)
    const killCommand = ['sh', '-c', `pkill -f "${processName}" || true`];
    const output = await execCommand(container, killCommand);

    return NextResponse.json({ 
      success: true, 
      output,
      message: `Process ${processName} killed successfully` 
    });
  } catch (error: any) {
    console.error('Error killing process:', error);
    
    const status = error.statusCode === 404 ? 404 : 500;
    const message = error.statusCode === 404 
      ? 'Container not found' 
      : 'Failed to kill process';
      
    return NextResponse.json(
      { error: message, details: String(error) },
      { status }
    );
  }
}
