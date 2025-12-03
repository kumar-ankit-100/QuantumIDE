// lib/s3.ts - Enhanced with real-time sync
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs-extra";
import path from "path";
import { Readable } from "stream";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_BUCKET_NAME!;

/**
 * Upload a single file to S3 with metadata
 */
export async function uploadFileToS3(
  projectId: string,
  filePath: string,
  fileContent: Buffer | string
): Promise<void> {
  const key = `projects/${projectId}/${filePath}`;
  
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: fileContent,
    Metadata: {
      lastModified: new Date().toISOString(),
      projectId: projectId,
    },
  });

  await s3Client.send(command);
  console.log(`[S3] Uploaded: ${key}`);
}

/**
 * Upload entire directory to S3 recursively
 */
export async function uploadDirectoryToS3(
  projectId: string,
  localPath: string,
  s3Prefix: string = ""
): Promise<void> {
  const items = await fs.readdir(localPath, { withFileTypes: true });

  const uploadPromises = items.map(async (item) => {
    const localItemPath = path.join(localPath, item.name);
    const s3ItemPath = s3Prefix ? `${s3Prefix}/${item.name}` : item.name;

    // Skip node_modules and other large directories
    if (item.name === "node_modules" || item.name === ".git" || item.name === "dist") {
      console.log(`[S3] Skipping: ${s3ItemPath}`);
      return;
    }

    if (item.isDirectory()) {
      await uploadDirectoryToS3(projectId, localItemPath, s3ItemPath);
    } else {
      const fileContent = await fs.readFile(localItemPath);
      await uploadFileToS3(projectId, s3ItemPath, fileContent);
    }
  });

  await Promise.all(uploadPromises);
}

/**
 * Download a file from S3
 */
export async function downloadFileFromS3(
  projectId: string,
  filePath: string
): Promise<string> {
  const key = `projects/${projectId}/${filePath}`;
  
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  const response = await s3Client.send(command);
  const stream = response.Body as Readable;
  
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  
  return Buffer.concat(chunks).toString("utf-8");
}

/**
 * Download entire project from S3 to local directory
 */
export async function downloadProjectFromS3(
  projectId: string,
  localPath: string
): Promise<void> {
  const files = await listProjectFilesOnS3(projectId);
  
  await fs.ensureDir(localPath);

  const downloadPromises = files.map(async (filePath) => {
    const fullPath = path.join(localPath, filePath);
    await fs.ensureDir(path.dirname(fullPath));
    
    const content = await downloadFileFromS3(projectId, filePath);
    await fs.writeFile(fullPath, content);
    console.log(`[S3] Downloaded: ${filePath}`);
  });

  await Promise.all(downloadPromises);
}

/**
 * List all files in a project on S3
 */
export async function listProjectFilesOnS3(projectId: string): Promise<string[]> {
  const prefix = `projects/${projectId}/`;
  const files: string[] = [];
  
  let continuationToken: string | undefined;
  
  do {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });
    
    const response = await s3Client.send(command);
    
    if (response.Contents) {
      for (const item of response.Contents) {
        if (item.Key) {
          const relativePath = item.Key.replace(prefix, "");
          if (relativePath) {
            files.push(relativePath);
          }
        }
      }
    }
    
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);
  
  return files;
}

/**
 * Delete entire project from S3
 */
export async function deleteProjectFromS3(projectId: string): Promise<void> {
  const files = await listProjectFilesOnS3(projectId);
  
  const deletePromises = files.map(async (filePath) => {
    const key = `projects/${projectId}/${filePath}`;
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });
    await s3Client.send(command);
  });

  await Promise.all(deletePromises);
  console.log(`[S3] Deleted project: ${projectId}`);
}

/**
 * Sync local changes to S3 (incremental)
 */
export async function syncLocalToS3(
  projectId: string,
  localPath: string
): Promise<void> {
  console.log(`[S3] Syncing ${projectId} to S3...`);
  await uploadDirectoryToS3(projectId, localPath);
  console.log(`[S3] Sync completed for ${projectId}`);
}

/**
 * Sync container files to S3 (extract via tar, upload)
 */
export async function syncContainerToS3(
  container: any,
  projectId: string,
  containerPath: string = "/app"
): Promise<void> {
  console.log(`[S3] Syncing container ${projectId} to S3...`);
  
  const tar = await import('tar-stream');
  const extract = tar.extract();
  
  const tarStream = await container.getArchive({ path: containerPath });
  
  const fileBuffers: { [path: string]: Buffer } = {};
  
  extract.on('entry', (header, stream, next) => {
    const chunks: Buffer[] = [];
    
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => {
      if (header.type === 'file') {
        // Remove leading "app/" from path
        const relativePath = header.name.replace(/^app\//, '');
        if (relativePath) {
          fileBuffers[relativePath] = Buffer.concat(chunks);
        }
      }
      next();
    });
    stream.resume();
  });
  
  await new Promise<void>((resolve, reject) => {
    extract.on('finish', () => resolve());
    extract.on('error', reject);
    tarStream.pipe(extract);
  });
  
  // Upload all files to S3
  const uploadPromises = Object.entries(fileBuffers).map(([filePath, content]) =>
    uploadFileToS3(projectId, filePath, content)
  );
  
  await Promise.all(uploadPromises);
  console.log(`[S3] Uploaded ${uploadPromises.length} files from container to S3`);
}

/**
 * Restore project from S3 into container (download + putArchive)
 */
export async function restoreContainerFromS3(
  container: any,
  projectId: string,
  containerPath: string = "/app"
): Promise<void> {
  console.log(`[S3] Restoring ${projectId} from S3 into container...`);
  
  const files = await listProjectFilesOnS3(projectId);
  
  if (files.length === 0) {
    console.log(`[S3] No files found in S3 for ${projectId}, skipping restore`);
    return;
  }
  
  const tar = await import('tar-stream');
  const pack = tar.pack();
  
  // Download all files and add to tar stream
  for (const filePath of files) {
    try {
      const content = await downloadFileFromS3(projectId, filePath);
      const buffer = Buffer.from(content);
      
      pack.entry({ name: filePath, size: buffer.length }, buffer);
      console.log(`[S3] Added ${filePath} to restore archive`);
    } catch (err: any) {
      console.error(`[S3] Failed to download ${filePath}: ${err.message}`);
    }
  }
  
  pack.finalize();
  
  // Upload tar to container
  await container.putArchive(pack, { path: containerPath });
  console.log(`[S3] Restored ${files.length} files from S3 into container`);
}
