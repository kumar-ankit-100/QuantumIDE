import { NextRequest, NextResponse } from 'next/server';
import Docker from 'dockerode';
import { execCommand } from '@/lib/containerFileHelpers';

const docker = new Docker();

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const container = docker.getContainer(id);
    
    // Read metadata from container
    const metadataJson = await execCommand(
      container, 
      ['cat', '/app/.quantumide-metadata.json']
    );
    
    if (!metadataJson || metadataJson.trim() === '') {
      return NextResponse.json(
        { error: "Project metadata not found in container" },
        { status: 404 }
      );
    }

    const metadata = JSON.parse(metadataJson);
    
    return NextResponse.json(metadata);
  } catch (error: any) {
    console.error('Error reading project metadata from container:', error);
    return NextResponse.json(
      { error: 'Failed to read project metadata', details: error.message || String(error) },
      { status: 500 }
    );
  }
}
