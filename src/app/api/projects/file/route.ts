// app/api/projects/file/route.ts (Simplified Version)
import { NextRequest, NextResponse } from "next/server";
import { 
  getContainerByProjectId,
  readFileFromContainer,
  writeFileToContainer,
  deleteFileFromContainer
} from "@/lib/containerFileHelpers";
import { updateContainerActivity } from "@/lib/containerManager";

/**
 * GET - Read file from container
 */
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  const filePath = req.nextUrl.searchParams.get("filePath");

  if (!projectId || !filePath) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  try {
    const container = await getContainerByProjectId(projectId);
    
    if (!container) {
      return NextResponse.json({ error: "Container not found" }, { status: 404 });
    }
    // console.log(container );

    const content = await readFileFromContainer(container, `/app/${filePath}`);
    console.log("Read file content:", content);
    updateContainerActivity(`${projectId}-dev`);

    return NextResponse.json({ content });
    
  } catch (err: any) {
    console.error(`Error reading file:`, err);
    
    if (err.message.includes("File not found")) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST - Write file to container
 */
export async function POST(req: NextRequest) {
  const { projectId, filePath, content } = await req.json();

  if (!projectId || !filePath) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }
  console.log("POST file content:", projectId, filePath, content);

  try {
    const container = await getContainerByProjectId(projectId);
    
    if (!container) {
      return NextResponse.json({ error: "Container not found" }, { status: 404 });
    }

    console.log("Obtained container:", container.id);

    await writeFileToContainer(container.id, `/app/${filePath}`, content);
    
    updateContainerActivity(`${projectId}-dev`);

    return NextResponse.json({ success: true });
    
  } catch (err: any) {
    console.error(`Error writing file:`, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE - Delete file from container
 */
export async function DELETE(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  const filePath = req.nextUrl.searchParams.get("filePath");

  if (!projectId || !filePath) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  try {
    const container = await getContainerByProjectId(projectId);
    
    if (!container) {
      return NextResponse.json({ error: "Container not found" }, { status: 404 });
    }

    await deleteFileFromContainer(container, `/app/${filePath}`);
    
    updateContainerActivity(`${projectId}-dev`);

    return NextResponse.json({ success: true });
    
  } catch (err: any) {
    console.error(`Error deleting file:`, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}





// import { NextRequest, NextResponse } from "next/server";
// import fs from "fs-extra";
// import path from "path";
// import { uploadFileToS3, syncLocalToS3 } from "@/lib/s3";
// import { updateContainerActivity } from "@/lib/containerManager";

// const PROJECTS_DIR = path.join(process.cwd(), "projects");

// export async function GET(req: NextRequest) {
//   const projectId = req.nextUrl.searchParams.get("projectId");
//   const filePath = req.nextUrl.searchParams.get("filePath");

//   if (!projectId || !filePath) {
//     return NextResponse.json({ error: "Missing params" }, { status: 400 });
//   }

//   const fullPath = path.join(PROJECTS_DIR, projectId, filePath);

//   if (!(await fs.pathExists(fullPath))) {
//     return NextResponse.json({ error: "File not found" }, { status: 404 });
//   }

//   const content = await fs.readFile(fullPath, "utf-8");
  
//   // Update activity
//   updateContainerActivity(`${projectId}-dev`);

//   return NextResponse.json({ content });
// }

// export async function POST(req: NextRequest) {
//   const { projectId, filePath, content } = await req.json();

//   if (!projectId || !filePath) {
//     return NextResponse.json({ error: "Missing params" }, { status: 400 });
//   }

//   const fullPath = path.join(PROJECTS_DIR, projectId, filePath);
  
//   // Write to local file
//   await fs.writeFile(fullPath, content, "utf-8");
  
//   // Update activity
//   updateContainerActivity(`${projectId}-dev`);

//   // Sync to S3 asynchronously
//   uploadFileToS3(projectId, filePath, content).catch(err => {
//     console.error(`[S3] File upload failed: ${err.message}`);
//   });

//   return NextResponse.json({ success: true });
// }
