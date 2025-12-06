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
    
    // Check if container exists
    let inspect;
    try {
      inspect = await container.inspect();
    } catch (err: any) {
      if (err.statusCode === 404) {
        return NextResponse.json(
          { 
            error: "Container not found. Please restart the project.",
            needsRecreation: true
          },
          { status: 404 }
        );
      }
      throw err;
    }
    
    const portBindings = inspect.NetworkSettings?.Ports || {};
    
    // If no ports are mapped, suggest container recreation
    if (Object.keys(portBindings).length === 0) {
      console.error('⚠️ Container has NO port mappings!');
      return NextResponse.json(
        { 
          error: "Container has no port mappings. Please recreate the container.",
          needsRecreation: true,
          suggestion: "POST /api/projects/" + projectId + "/recreate"
        },
        { status: 404 }
      );
    }
    
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
    
    // Method 1: Check if process is running and listening on a port
    try {
      const psExec = await container.exec({
        Cmd: ['sh', '-c', 'ps aux | grep -E "(node|vite|next-server)" | grep -v grep'],
        AttachStdout: true,
        AttachStderr: false,
      });
      
      const psStream = await psExec.start({ Detach: false, Tty: false });
      let psOutput = '';
      
      psStream.on('data', (chunk: Buffer) => {
        psOutput += chunk.toString();
      });
      
      await new Promise((resolve) => {
        psStream.on('end', resolve);
        setTimeout(resolve, 500);
      });
      
      console.log('Process check:', psOutput ? 'Dev server is running' : 'No dev server found');
    } catch (err) {
      // Process check failed
    }

    // Method 2: Read log file directly (fastest method)
    try {
      const logExec = await container.exec({
        Cmd: ['sh', '-c', 'cat /tmp/dev-server.log 2>/dev/null | tail -50'],
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
        setTimeout(resolve, 1000); // Increased timeout
      });
      
      // Parse multiple patterns:
      // Vite: "➜  Local:   http://localhost:5177/"
      // Next.js: "- Local:        http://localhost:3000"
      // Next.js: "ready - started server on 0.0.0.0:3000"
      // Next.js: "Local: http://localhost:3000"
      const patterns = [
        /localhost:(\d+)/i,
        /0\.0\.0\.0:(\d+)/i,
        /server on [\w.:]+:(\d+)/i,
        /port[:\s]+(\d+)/i,
        /:(\d{4,5})\b/  // Any 4-5 digit number after colon
      ];
      
      for (const pattern of patterns) {
        const portMatch = logOutput.match(pattern);
        if (portMatch) {
          const port = parseInt(portMatch[1]);
          // Validate it's a reasonable port number
          if (port >= 3000 && port <= 9999) {
            detectedPort = port;
            console.log(`Detected port ${port} using pattern:`, pattern);
            break;
          }
        }
      }
    } catch (err) {
      console.error('Log file check failed:', err);
    }
    
    // If we found a port, get the host mapping
    if (detectedPort) {
      const inspect = await container.inspect();
      const portBindings = inspect.NetworkSettings?.Ports || {};
      
      // Look for the exact port mapping
      const portKey = `${detectedPort}/tcp`;
      console.log(`Looking for port mapping: ${portKey}`);
      
      if (portBindings[portKey] && portBindings[portKey].length > 0) {
        const hostPort = parseInt(portBindings[portKey][0].HostPort);
        
        console.log(`✓ Port ${detectedPort} is mapped to host port ${hostPort}`);
        
        return NextResponse.json({ 
          internalPort: detectedPort,
          hostPort: hostPort,
          previewUrl: `http://localhost:${hostPort}`,
          serverType
        });
      }
      
      // Port detected but not mapped - this is the problem
      console.warn(`✗ Port ${detectedPort} detected in logs but NOT mapped to host`);
      console.log('Available port mappings:', Object.keys(portBindings));
      
      // Strategy: Find any mapped port and use it (container might have been created differently)
      const mappedPorts = Object.keys(portBindings).filter(key => 
        portBindings[key] && portBindings[key].length > 0
      );
      
      if (mappedPorts.length > 0) {
        // Prefer ports in the 3000-5180 range (dev server ports)
        const devServerPort = mappedPorts.find(p => {
          const port = parseInt(p.split('/')[0]);
          return port >= 3000 && port <= 5180;
        }) || mappedPorts[0];
        
        const hostPort = parseInt(portBindings[devServerPort][0].HostPort);
        const internalPort = parseInt(devServerPort.split('/')[0]);
        
        console.log(`→ Using fallback: container port ${internalPort} -> host port ${hostPort}`);
        console.warn(`Note: Dev server is on ${detectedPort} but container port ${internalPort} is mapped`);
        
        return NextResponse.json({ 
          internalPort,
          hostPort,
          previewUrl: `http://localhost:${hostPort}`,
          serverType,
          warning: `Dev server listening on ${detectedPort} but using mapped port ${internalPort}`
        });
      }
    }

    return NextResponse.json(
      { error: "No active dev server found or port not mapped to host" },
      { status: 404 }
    );
  } catch (err: any) {
    const status = err.statusCode === 404 ? 404 : 500;
    const message = err.statusCode === 404 
      ? 'Container not found' 
      : `Failed to get port: ${err.message}`;
      
    return NextResponse.json(
      { error: message },
      { status }
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