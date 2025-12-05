import { NextRequest, NextResponse } from "next/server";
import Docker from "dockerode";

const docker = new Docker();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const container = docker.getContainer(projectId);
    
    // Read the dev server log file
    const logExec = await container.exec({
      Cmd: ['sh', '-c', 'cat /tmp/dev-server.log 2>/dev/null || echo "Log file not found"'],
      AttachStdout: true,
      AttachStderr: true,
    });
    
    const logStream = await logExec.start({ Detach: false, Tty: false });
    let logOutput = '';
    
    logStream.on('data', (chunk: Buffer) => {
      logOutput += chunk.toString();
    });
    
    await new Promise((resolve) => {
      logStream.on('end', resolve);
      setTimeout(resolve, 2000);
    });

    return NextResponse.json({ 
      logs: logOutput,
      length: logOutput.length
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to get logs: ${err.message}` },
      { status: 500 }
    );
  }
}
