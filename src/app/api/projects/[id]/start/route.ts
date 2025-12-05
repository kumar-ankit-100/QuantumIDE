import { NextRequest, NextResponse } from "next/server";
import Docker from "dockerode";
import { startDevServer, execCommand } from "@/lib/containerManager";

const docker = new Docker();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const container = docker.getContainer(projectId);
    
    // Read metadata to determine project type
    let serverType: "vite" | "nextjs" = "vite";
    let defaultPort = 5173;
    
    try {
      const metadataJson = await execCommand(
        container,
        ["cat", "/app/.quantumide-metadata.json"]
      );
      
      if (metadataJson && metadataJson.trim()) {
        const metadata = JSON.parse(metadataJson);
        serverType = metadata.serverConfig?.type || "vite";
        defaultPort = metadata.serverConfig?.defaultPort || 5173;
      }
    } catch (err) {
      console.warn('Could not read metadata, defaulting to Vite');
    }

    const { hostPort } = await startDevServer(container, defaultPort, serverType);

    return NextResponse.json({ 
      message: "Dev server started",
      hostPort,
      previewUrl: `http://localhost:${hostPort}`,
      serverType
    });
  } catch (err: any) {
    console.error(`Failed to start dev server: ${err.message}`);
    return NextResponse.json(
      { error: `Failed to start dev server: ${err.message}` },
      { status: 500 }
    );
  }
}
