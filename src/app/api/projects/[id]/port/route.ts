import { NextRequest, NextResponse } from "next/server";
import Docker from "dockerode";
import { getContainerPort } from "@/lib/containerManager";

const docker = new Docker();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const container = docker.getContainer(projectId);
    
    let detectedPort = null;
    
    // Quick check: Read log file directly (fastest method)
    try {
      const logExec = await container.exec({
        Cmd: ['sh', '-c', 'grep -E "Local:.+localhost:[0-9]+" /tmp/dev-server.log 2>/dev/null | tail -1'],
        AttachStdout: true,
        AttachStderr: false,
      });
      
      const logStream = await logExec.start({ Detach: false, Tty: false });
      let logOutput = '';
      
      logStream.on('data', (chunk: Buffer) => {
        logOutput += chunk.toString();
      });
      
      await new Promise((resolve) => {
        logStream.on('end', resolve);
        setTimeout(resolve, 500); // Max 500ms timeout
      });
      
      // Parse: "➜  Local:   http://localhost:5177/"
      const portMatch = logOutput.match(/localhost:(\d+)/);
      if (portMatch) {
        detectedPort = parseInt(portMatch[1]);
      }
    } catch (err) {
      // Log file check failed
    }
    
    // If we found a port, get the host mapping
    if (detectedPort) {
      const inspect = await container.inspect();
      const portBindings = inspect.NetworkSettings?.Ports || {};
      
      // Look for the exact port mapping
      const portKey = `${detectedPort}/tcp`;
      if (portBindings[portKey] && portBindings[portKey].length > 0) {
        const hostPort = parseInt(portBindings[portKey][0].HostPort);
        
        return NextResponse.json({ 
          internalPort: detectedPort,
          hostPort: hostPort,
          previewUrl: `http://localhost:${hostPort}`
        });
      }
    }

    return NextResponse.json(
      { error: "No active Vite server found" },
      { status: 404 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to get port: ${err.message}` },
      { status: 500 }
    );
  }
}
