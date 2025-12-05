import { NextRequest, NextResponse } from "next/server";
import Docker from "dockerode";
import { createContainer } from "@/lib/containerManager";
import { execCommand } from "@/lib/containerFileHelpers";

const docker = new Docker();

/**
 * Recreate container with proper port mappings
 * This is needed when a container was created without ports exposed
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    
    console.log(`Recreating container ${projectId} with proper port mappings...`);
    
    // Get the old container
    const oldContainer = docker.getContainer(projectId);
    
    // Read metadata from old container before deleting
    let metadata = null;
    try {
      const metadataJson = await execCommand(oldContainer, ['cat', '/app/.quantumide-metadata.json']);
      metadata = JSON.parse(metadataJson);
      console.log('Retrieved metadata from old container');
    } catch (err) {
      console.warn('Could not read metadata from old container, using defaults');
      metadata = {
        serverConfig: {
          type: 'vite',
          defaultPort: 5173
        }
      };
    }
    
    // Get list of all files from old container to preserve them
    let fileContents: { [key: string]: string } = {};
    try {
      const findExec = await oldContainer.exec({
        Cmd: ['sh', '-c', 'find /app -type f ! -path "*/node_modules/*" ! -path "*/.git/*" 2>/dev/null'],
        AttachStdout: true,
        AttachStderr: false,
      });
      
      const findStream = await findExec.start({ Detach: false, Tty: false });
      let filePaths = '';
      
      findStream.on('data', (chunk: Buffer) => {
        filePaths += chunk.toString();
      });
      
      await new Promise((resolve) => {
        findStream.on('end', resolve);
        setTimeout(resolve, 2000);
      });
      
      // Read each file
      const paths = filePaths.trim().split('\n').filter(p => p && p !== '/app/.quantumide-metadata.json');
      console.log(`Found ${paths.length} files to preserve`);
      
      for (const path of paths.slice(0, 100)) { // Limit to 100 files to avoid timeout
        try {
          const content = await execCommand(oldContainer, ['cat', path]);
          fileContents[path] = content;
        } catch (err) {
          // Skip files that can't be read
        }
      }
    } catch (err) {
      console.warn('Could not read files from old container:', err);
    }
    
    // Stop and remove old container
    try {
      await oldContainer.stop({ t: 5 });
    } catch (err) {
      // Container might already be stopped
    }
    
    try {
      await oldContainer.remove({ force: true });
      console.log('Old container removed');
    } catch (err) {
      console.error('Failed to remove old container:', err);
    }
    
    // Create new container with proper port mappings
    const newContainer = await createContainer(projectId, metadata);
    console.log('New container created with port mappings');
    
    // Restore files to new container
    console.log(`Restoring ${Object.keys(fileContents).length} files...`);
    for (const [path, content] of Object.entries(fileContents)) {
      try {
        // Create directory if needed
        const dir = path.substring(0, path.lastIndexOf('/'));
        if (dir) {
          await execCommand(newContainer, ['mkdir', '-p', dir]);
        }
        
        // Write file (escape content properly)
        const escapedContent = content.replace(/'/g, "'\\''");
        await execCommand(newContainer, ['sh', '-c', `cat > '${path}' << 'EOFMARKER'\n${content}\nEOFMARKER`]);
      } catch (err) {
        console.error(`Failed to restore file ${path}:`, err);
      }
    }
    
    // Get port mappings from new container
    const inspect = await newContainer.inspect();
    const portBindings = inspect.NetworkSettings?.Ports || {};
    
    return NextResponse.json({
      success: true,
      message: 'Container recreated with port mappings',
      containerId: newContainer.id,
      portMappings: Object.keys(portBindings),
      filesRestored: Object.keys(fileContents).length
    });
  } catch (error: any) {
    console.error('Failed to recreate container:', error);
    return NextResponse.json(
      { error: `Failed to recreate container: ${error.message}` },
      { status: 500 }
    );
  }
}
