import { NextRequest, NextResponse } from "next/server";
import Docker from "dockerode";

const docker = new Docker();

// Store terminal sessions
const terminalSessions = new Map<string, {
  exec: Docker.Exec;
  stream: NodeJS.ReadWriteStream;
}>();

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
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      Cmd: ["/bin/bash", "-c", command],
      Env: ["TERM=xterm-256color"],
    });

    const stream = await exec.start({ Tty: true, stdin: true });
    
    let output = "";
    
    stream.on("data", (data: Buffer) => {
      output += data.toString();
    });
    
    await new Promise((resolve) => {
      stream.on("end", resolve);
      setTimeout(resolve, 5000); // Max 5 second wait
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
