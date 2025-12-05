// lib/containerFileHelpers.ts
import Docker from "dockerode";
// import { execCommand } from "./containerManager";
import { Readable } from "stream";

const COMMAND_TIMEOUT = 120000;


export async function execCommand(
  container: Docker.Container,
  command: string[],
  workingDir: string = "/app"
): Promise<string> {
  console.log(`[${new Date().toISOString()}] Executing: ${command.join(" ")}`);

  const exec = await container.exec({
    Cmd: command,
    AttachStdout: true,
    AttachStderr: true,
    Tty: false,
    WorkingDir: workingDir,
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Command timed out after ${COMMAND_TIMEOUT / 1000}s`));
    }, COMMAND_TIMEOUT);

    // ✅ FIX: Add Detach: false and hijack: true
    exec.start({ 
      Detach: false,  // ← CRITICAL: Don't detach
      Tty: false,
      hijack: true    // ← CRITICAL: Keep connection open
    }, (err, stream) => {
      if (err) {
        clearTimeout(timeout);
        reject(err);
        return;
      }

      if (!stream) {
        clearTimeout(timeout);
        reject(new Error("No stream returned from exec"));
        return;
      }

      const chunks: Buffer[] = [];

      // ✅ Collect data immediately
      stream.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });

      // ✅ Handle completion
      stream.on("end", () => {
        clearTimeout(timeout);
        
        if (chunks.length === 0) {
          resolve("");
          return;
        }

        const buffer = Buffer.concat(chunks);
        
        // Parse Docker multiplexed stream
        let output = "";
        let offset = 0;

        while (offset < buffer.length) {
          if (offset + 8 > buffer.length) break;

          const size = buffer.readUInt32BE(offset + 4);
          
          if (offset + 8 + size > buffer.length) break;

          const payload = buffer.slice(offset + 8, offset + 8 + size);
          output += payload.toString('utf8');

          offset += 8 + size;
        }

        resolve(output);
      });

      // ✅ Handle errors properly
      stream.on("error", (streamErr) => {
        clearTimeout(timeout);
        console.error(`[${new Date().toISOString()}] Stream error:`, streamErr);
        reject(streamErr);
      });
    });
  });
}

/**
 * Read file from container
 */
export async function readFileFromContainer(
  container: Docker.Container,
  filePath: string
): Promise<string> {
  try {
    const content = await execCommand(
      container,
      ["cat", filePath],
      "/app"
    );
    // Aggressively strip all BOM and corruption characters
    // This handles: UTF-8 BOM, UTF-16 BOM, UTF-32 BOM, replacement character, and other artifacts
    let cleaned = content;
    
    // Strip UTF-8 BOM (EF BB BF)
    if (cleaned.charCodeAt(0) === 0xFEFF || cleaned.charCodeAt(0) === 0xEFBBBF) {
      cleaned = cleaned.substring(1);
    }
    
    // Strip any leading non-printable or corruption characters
    // Match: BOM variants, replacement character (�), Q, }, ), and any other weird leading chars
    cleaned = cleaned.replace(/^[\uFEFF\uFFFE\uFFFD\uEF\uBB\uBF\x00-\x1F\x7F]+/, '');
    cleaned = cleaned.replace(/^[Q}\)�]+/, '');
    
    return cleaned;
  } catch (err: any) {
    if (err.message.includes("No such file")) {
      throw new Error(`File not found: ${filePath}`);
    }
    throw err;
  }
}

/**
 * Write file to container (safe for special characters)
 */

const docker = new Docker();

export async function writeFileToContainer(
  containerId: string,
  containerFilePath: string,
  content: string
): Promise<void> {
    console.log("containerId VALUE =", containerId, "TYPE =", typeof containerId);

  const container = docker.getContainer(containerId);
  console.log(`[${new Date().toISOString()}] Writing to container ID: ${container.id}`);
  // console.log(container);

  console.log(`[${new Date().toISOString()}] Writing to: ${  containerFilePath}`);

 
const base64 = Buffer.from(content, "utf-8").toString("base64");

    // Write file content using echo command to avoid tar archive issues
    try {
        console.log(`[${new Date().toISOString()}] Writing file to container: ${containerFilePath}`);
    const execWrite = await container.exec({
      Cmd: [
    "bash",
    "-c",
    `echo "${base64}" | base64 -d > "${containerFilePath}"`
  ],
      AttachStdout: true,
      AttachStderr: true,
    });

    await new Promise<void>((resolve, reject) => {
      execWrite.start((err, stream) => {
        if (err) {
          console.error(`[${new Date().toISOString()}] Failed to write file: ${err.message}`);
          reject(err);
          return;
        }
        docker.modem.demuxStream(
          stream,
          (data) => console.log(`[${new Date().toISOString()}] write stdout: ${data.toString()}`),
          (data) => console.error(`[${new Date().toISOString()}] write stderr: ${data.toString()}`)
        );
        stream.on("end", () => {
          console.log(`[${new Date().toISOString()}] ✅ Wrote file: ${containerFilePath}`);
          resolve();
        });
      });
    });
} catch (err) {
    console.error(`[${new Date().toISOString()}] Error writing file to container: ${err.message}`);
    throw err;
}

}
// export async function writeFileToContainer(
//   container: Docker.Container,
//   filePath: string,
//   content: strinhref="https://react.dev" target="_blank">\n          <img src={reactLogo} className="logo react" alt="React logo" />\n        </a>\n      </div>\n      <h1>Vite + React</h1>\n      <div className="card">\n        <button onClick={() => setCount((count) => count + 1)}>\n          count is {count}\n        </button>\n        <p>\n          Edit <code>src/App.jsx</code> and save to test HMR\n        </p>\n      </div>\n      <p className="read-the-docs">\n        Click on the Vite and React logos to learn more\n      </p>\n    </>\n  )\n}\n\nexport default App\n
// ): Promise<void> {
//   // Ensure parent directory exists
//   const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
//   console.log("Directory path:", dirPath);
//   if (dirPath && dirPath !== '/app') {
//     await execCommand(
//       container,
//       ["mkdir", "-p", dirPath],
//       "/app"
//     );
//   }

//   // Use base64 encoding to safely handle special characters
//   const base64Content = Buffer.from(content).toString('base64');
  
//   await execCommand(
//     container,
//     ["bash", "-c", `echo '${base64Content}' | base64 -d > '${filePath}'`],
//     "/app"
//   );
// }

/**
 * Check if file exists in container
 */
export async function fileExistsInContainer(
  container: Docker.Container,
  filePath: string
): Promise<boolean> {
  try {
    const result = await execCommand(
      container,
      ["test", "-f", filePath, "&&", "echo", "exists"],
      "/app"
    );
    return result.trim() === "exists";
  } catch {
    return false;
  }
}

/**
 * Create directory in container
 */
export async function createDirectoryInContainer(
  container: Docker.Container,
  dirPath: string
): Promise<void> {
  await execCommand(
    container,
    ["mkdir", "-p", dirPath],
    "/app"
  );
}

/**
 * Delete file from container
 */
export async function deleteFileFromContainer(
  container: Docker.Container,
  filePath: string
): Promise<void> {
  await execCommand(
    container,
    ["rm", "-f", filePath],
    "/app"
  );
}

/**
 * Delete directory from container
 */
export async function deleteDirectoryFromContainer(
  container: Docker.Container,
  dirPath: string
): Promise<void> {
  await execCommand(
    container,
    ["rm", "-rf", dirPath],
    "/app"
  );
}

/**
 * Rename/move file in container
 */
export async function moveFileInContainer(
  container: Docker.Container,
  oldPath: string,
  newPath: string
): Promise<void> {
  // Ensure destination directory exists
  const newDir = newPath.substring(0, newPath.lastIndexOf('/'));
  if (newDir) {
    await createDirectoryInContainer(container, newDir);
  }

  await execCommand(
    container,
    ["mv", oldPath, newPath],
    "/app"
  );
}

/**
 * Copy file within container
 */
export async function copyFileInContainer(
  container: Docker.Container,
  sourcePath: string,
  destPath: string
): Promise<void> {
  await execCommand(
    container,
    ["cp", sourcePath, destPath],
    "/app"
  );
}

/**
 * Get file stats from container
 */
export async function getFileStatsFromContainer(
  container: Docker.Container,
  filePath: string
): Promise<{
  size: number;
  isDirectory: boolean;
  modified: Date;
}> {
  const output = await execCommand(
    container,
    ["stat", "-c", "%s %F %Y", filePath],
    "/app"
  );

  const [sizeStr, type, mtimeStr] = output.trim().split(' ');
  
  return {
    size: parseInt(sizeStr, 10),
    isDirectory: type === "directory",
    modified: new Date(parseInt(mtimeStr, 10) * 1000)
  };
}

/**
 * List files in directory (simple)
 */
export async function listFilesInContainer(
  container: Docker.Container,
  dirPath: string
): Promise<string[]> {
  const output = await execCommand(
    container,
    ["ls", "-1", dirPath],
    "/app"
  );

  return output
    .trim()
    .split('\n')
    .filter(Boolean);
}

/**
 * Get container instance by project ID
 */
export async function getContainerByProjectId(
  projectId: string
): Promise<Docker.Container | null> {
  try {
    const allContainers = await docker.listContainers();
    const containerData = allContainers.find(c => 
      c.Names.some(name => name.includes(projectId))
    );

    if (!containerData) {
      return null;
    }

    return docker.getContainer(containerData.Id);
  } catch (err) {
    console.error(`Error getting container for project ${projectId}:`, err);
    return null;
  }
}

/**
 * Write multiple files to container (batch operation)
 */
export async function writeMultipleFilesToContainer(
  container: Docker.Container,
  files: Array<{ path: string; content: string }>
): Promise<void> {
  for (const file of files) {
    await writeFileToContainer(container, file.path, file.content);
  }
}

/**
 * Alternative: Write file using Docker's putArchive (for binary files)
 */
export async function writeFileToContainerViaTar(
  container: Docker.Container,
  filePath: string,
  content: Buffer | string
): Promise<void> {
  const tar = await import('tar-stream');
  const pack = tar.pack();

  const fileName = filePath.split('/').pop() || 'file';
  const dirPath = filePath.substring(0, filePath.lastIndexOf('/')) || '/app';

  // Ensure content is a Buffer
  const buffer = Buffer.isBuffer(content) 
    ? content 
    : Buffer.from(content);

  pack.entry({ name: fileName, size: buffer.length }, buffer, (err) => {
    if (err) throw err;
    pack.finalize();
  });

  await container.putArchive(pack, { path: dirPath });
}

/**
 * Read binary file from container
 */
export async function readBinaryFileFromContainer(
  container: Docker.Container,
  filePath: string
): Promise<Buffer> {
  const tar = await import('tar-stream');
  const extract = tar.extract();
  
  const dirPath = filePath.substring(0, filePath.lastIndexOf('/')) || '/app';
  const fileName = filePath.split('/').pop() || '';

  const tarStream = await container.getArchive({ path: filePath });
  
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];

    extract.on('entry', (header, stream, next) => {
      if (header.name === fileName || header.name === `./${fileName}`) {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => {
          resolve(Buffer.concat(chunks));
          next();
        });
        stream.resume();
      } else {
        stream.resume();
        next();
      }
    });

    extract.on('finish', () => {
      if (chunks.length === 0) {
        reject(new Error('File not found in archive'));
      }
    });

    extract.on('error', reject);
    tarStream.pipe(extract);
  });
}