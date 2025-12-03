import { NextRequest, NextResponse } from "next/server";
import Docker from "dockerode";
import { getContainerPort } from "@/lib/containerManager";
import { execCommand } from "@/lib/containerFileHelpers";

const docker = new Docker();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const container = docker.getContainer(projectId);
    
    let detectedPort = null;
    let serverType = "vite"; // default
    
    // Try to read project metadata from container to determine server type
    try {
      const metadataJson = await execCommand(
        container,
        ['cat', '/app/.quantumide-metadata.json']
      );
      
      if (metadataJson && metadataJson.trim() !== '') {
        const metadata = JSON.parse(metadataJson);
        serverType = metadata.serverConfig?.type || "vite";
        const defaultPort = metadata.serverConfig?.defaultPort;
        
        // For Next.js or known port, try it directly first
        if (defaultPort) {
          const hostPort = await getContainerPort(projectId, defaultPort);
          if (hostPort) {
            // Verify the port is actually serving by checking the log
            const logCheck = await checkServerLog(container, defaultPort);
            if (logCheck) {
              return NextResponse.json({ 
                internalPort: defaultPort,
                hostPort: hostPort,
                previewUrl: `http://localhost:${hostPort}`,
                serverType
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn('Failed to read metadata from container, falling back to log detection');
    }
    
    // Quick check: Read log file directly (fastest method)
    try {
      const logExec = await container.exec({
        Cmd: ['sh', '-c', 'grep -E "(Local:.+localhost:[0-9]+|localhost:[0-9]+.*ready)" /tmp/dev-server.log 2>/dev/null | tail -1'],
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
      
      // Parse multiple patterns:
      // Vite: "➜  Local:   http://localhost:5177/"
      // Next.js: "- Local:        http://localhost:3000"
      // Next.js: "ready - started server on 0.0.0.0:3000"
      const patterns = [
        /localhost:(\d+)/,
        /server on [\w.:]+:(\d+)/,
        /port (\d+)/i
      ];
      
      for (const pattern of patterns) {
        const portMatch = logOutput.match(pattern);
        if (portMatch) {
          detectedPort = parseInt(portMatch[1]);
          break;
        }
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
          previewUrl: `http://localhost:${hostPort}`,
          serverType
        });
      }
    }

    return NextResponse.json(
      { error: "No active dev server found" },
      { status: 404 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to get port: ${err.message}` },
      { status: 500 }
    );
  }
}

async function checkServerLog(container: Docker.Container, port: number): Promise<boolean> {
  try {
    const logExec = await container.exec({
      Cmd: ['sh', '-c', `grep -E "(localhost:${port}|port ${port})" /tmp/dev-server.log 2>/dev/null`],
      AttachStdout: true,
      AttachStderr: false,
    });
    
    const logStream = await logExec.start({ Detach: false, Tty: false });
    let found = false;
    
    logStream.on('data', (chunk: Buffer) => {
      if (chunk.toString().includes(port.toString())) {
        found = true;
      }
    });
    
    await new Promise((resolve) => {
      logStream.on('end', resolve);
      setTimeout(resolve, 300);
    });
    
    return found;
  } catch (err) {
    return false;
  }
}