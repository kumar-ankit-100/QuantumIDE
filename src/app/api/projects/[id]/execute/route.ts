import { NextRequest, NextResponse } from "next/server";
import Docker from "dockerode";

const docker = new Docker();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const { command } = await req.json();
    
    const container = docker.getContainer(projectId);
    
    // Create exec instance for command
    const exec = await container.exec({
      AttachStdout: true,
      AttachStderr: true,
      Cmd: ["/bin/bash", "-c", command],
    });

    const stream = await exec.start({ hijack: false });
    
    let output = "";
    
    stream.on("data", (data: Buffer) => {
      output += data.toString();
    });
    
    await new Promise((resolve) => {
      stream.on("end", resolve);
      setTimeout(resolve, 3000); // Max 3 second wait for quick commands
    });

    return NextResponse.json({ output });
  } catch (err: any) {
    console.error(`Failed to execute command: ${err.message}`);
    return NextResponse.json(
      { error: `Failed to execute command: ${err.message}` },
      { status: 500 }
    );
  }
}
