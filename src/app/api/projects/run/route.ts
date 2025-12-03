import { NextResponse } from "next/server";
import path from "path";
import fs from "fs-extra";
import { startDevServer, getContainerStatus } from "@/lib/containerManager";
import getPort from "get-port";
import Docker from "dockerode";

const docker = new Docker();

const PROJECTS_DIR = path.join(process.cwd(), "projects");

/**
 * Start development server for a project
 */
export async function POST(request: Request) {
  try {
    const { projectId } = await request.json();
    const port = await getPort();
    console.log(`Requested165616665465465464564 port: ${port}`);

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    const conatainers = await docker.listContainers({ all: true });
    const tempContainer = conatainers.find(c =>
      c.Names?.some(name => name.includes(projectId))
    );
    


    // Check if dev server already running
    const status = await getContainerStatus(projectId); // Use projectId directly, no -dev suffix
    console.log(`[${new Date().toISOString()}] Status of ${projectId}: ${status}`);
    console.log(`Temp container ports: ${tempContainer?.Ports.length}`);
    if (status === "running" && tempContainer.Ports.length != 0) {
      let port = tempContainer.Ports[0].PublicPort;
      return NextResponse.json({
        message: "Development server already running",
        port,
        url: `http://localhost:${port}`,
      });
    }
    console.log(`Starting dev server on port: ${port}`);

    if (!tempContainer) {
      return NextResponse.json(
        { error: "Container not found" },
        { status: 404 }
      );
    }

    const containerInstance = docker.getContainer(tempContainer.Id);

    // Start dev server
    const result = await startDevServer(containerInstance, port);

    return NextResponse.json({
      message: "Development server started",
      containerId: result.container.id,
      port: result.hostPort,
      url: `http://localhost:${result.hostPort}`,
    });
  } catch (err: any) {
    console.error(`[${new Date().toISOString()}] Failed to start dev server: ${err.message}`);
    return NextResponse.json(
      { error: `Failed to start dev server: ${err.message}` },
      { status: 500 }
    );
  }
}

/**
 * Get status of development server
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }
    
    const status = await getContainerStatus(projectId); // Use projectId directly
    // console.log(`[${new Date().toISOString()}] Status of ${projectId}: ${status}`);
    console.log(`Status of ${projectId}: ${status}`);
    return NextResponse.json({
      projectId,
      status: status || "stopped",
      isRunning: status === "running",
    });
  } catch (err: any) {
    console.error(`[${new Date().toISOString()}] Failed to get status: ${err.message}`);
    return NextResponse.json(
      { error: `Failed to get status: ${err.message}` },
      { status: 500 }
    );
  }
}