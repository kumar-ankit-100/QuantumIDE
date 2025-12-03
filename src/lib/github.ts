// lib/github.ts - Git-based persistence for container projects
import Docker from "dockerode";
import { execCommand } from "./containerFileHelpers";

const docker = new Docker();

/**
 * Initialize Git repository inside container
 */
export async function initGitInContainer(
  container: Docker.Container,
  projectId: string,
  userEmail: string = "user@quantumide.dev",
  userName: string = "QuantumIDE User"
): Promise<void> {
  console.log(`[Git] Initializing repository in container for ${projectId}`);
  
  try {
    // Install git if not present (node:20 doesn't have git by default)
    await execCommand(container, ["bash", "-c", "command -v git || (apt-get update && apt-get install -y git)"], "/app");
    
    // Initialize git repo
    await execCommand(container, ["git", "init"], "/app");
    
    // Configure git
    await execCommand(container, ["git", "config", "user.email", userEmail], "/app");
    await execCommand(container, ["git", "config", "user.name", userName], "/app");
    
    // Create .gitignore
    const gitignore = `node_modules/
.next/
dist/
build/
.env
.env.local
*.log
.DS_Store
coverage/
.vscode/
.idea/
`;
    
    await execCommand(
      container,
      ["bash", "-c", `cat > .gitignore << 'EOF'\n${gitignore}\nEOF`],
      "/app"
    );
    
    // Initial commit
    await execCommand(container, ["git", "add", "."], "/app");
    await execCommand(
      container,
      ["git", "commit", "-m", "Initial commit from QuantumIDE"],
      "/app"
    );
    
    console.log(`[Git] Repository initialized with initial commit`);
  } catch (err: any) {
    console.error(`[Git] Init failed: ${err.message}`);
    throw err;
  }
}

/**
 * Commit changes inside container
 */
export async function commitChanges(
  container: Docker.Container,
  message: string = "Save progress"
): Promise<void> {
  console.log(`[Git] Committing changes: ${message}`);
  
  try {
    // Add all changes
    await execCommand(container, ["git", "add", "."], "/app");
    
    // Check if there are changes to commit
    const status = await execCommand(container, ["git", "status", "--porcelain"], "/app");
    
    if (status.trim().length === 0) {
      console.log(`[Git] No changes to commit`);
      return;
    }
    
    // Commit
    await execCommand(
      container,
      ["git", "commit", "-m", message],
      "/app"
    );
    
    console.log(`[Git] Changes committed successfully`);
  } catch (err: any) {
    console.error(`[Git] Commit failed: ${err.message}`);
    throw err;
  }
}

/**
 * Add remote and push to GitHub (requires GitHub token in env)
 */
export async function pushToGitHub(
  container: Docker.Container,
  repoUrl: string,
  branch: string = "main",
  token?: string
): Promise<void> {
  console.log(`[Git] Pushing to GitHub: ${repoUrl}`);
  
  try {
    // If token provided, use authenticated URL
    let authUrl = repoUrl;
    if (token && repoUrl.includes("github.com")) {
      authUrl = repoUrl.replace("https://", `https://${token}@`);
    }
    
    // Add remote (remove if exists)
    await execCommand(
      container,
      ["bash", "-c", "git remote remove origin 2>/dev/null || true"],
      "/app"
    );
    await execCommand(container, ["git", "remote", "add", "origin", authUrl], "/app");
    
    // Set branch
    await execCommand(
      container,
      ["bash", "-c", `git branch -M ${branch}`],
      "/app"
    );
    
    // Push
    await execCommand(
      container,
      ["git", "push", "-u", "origin", branch, "--force"],
      "/app"
    );
    
    console.log(`[Git] Pushed to GitHub successfully`);
  } catch (err: any) {
    console.error(`[Git] Push failed: ${err.message}`);
    throw err;
  }
}

/**
 * Clone/pull from GitHub into container
 */
export async function cloneFromGitHub(
  container: Docker.Container,
  repoUrl: string,
  branch: string = "main",
  token?: string
): Promise<void> {
  console.log(`[Git] Cloning from GitHub: ${repoUrl}`);
  
  try {
    // Install git if not present
    await execCommand(container, ["bash", "-c", "command -v git || (apt-get update && apt-get install -y git)"], "/app");
    
    // If token provided, use authenticated URL
    let authUrl = repoUrl;
    if (token && repoUrl.includes("github.com")) {
      authUrl = repoUrl.replace("https://", `https://${token}@`);
    }
    
    // Check if already a git repo
    const isRepo = await execCommand(
      container,
      ["bash", "-c", "[ -d .git ] && echo 'yes' || echo 'no'"],
      "/app"
    );
    
    if (isRepo.trim() === "yes") {
      // Pull latest changes
      console.log(`[Git] Repository exists, pulling latest changes`);
      await execCommand(container, ["git", "fetch", "origin"], "/app");
      await execCommand(container, ["git", "reset", "--hard", `origin/${branch}`], "/app");
    } else {
      // Clone fresh
      console.log(`[Git] Cloning fresh repository`);
      
      // Remove /app contents first
      await execCommand(
        container,
        ["bash", "-c", "rm -rf /app/* /app/.* 2>/dev/null || true"],
        "/"
      );
      
      // Clone
      await execCommand(
        container,
        ["git", "clone", "-b", branch, authUrl, "/app"],
        "/"
      );
    }
    
    // Install dependencies after clone
    const hasPackageJson = await execCommand(
      container,
      ["bash", "-c", "[ -f package.json ] && echo 'yes' || echo 'no'"],
      "/app"
    );
    
    if (hasPackageJson.trim() === "yes") {
      console.log(`[Git] Installing dependencies...`);
      await execCommand(container, ["npm", "install"], "/app");
    }
    
    console.log(`[Git] Cloned from GitHub successfully`);
  } catch (err: any) {
    console.error(`[Git] Clone failed: ${err.message}`);
    throw err;
  }
}

/**
 * Get git status from container
 */
export async function getGitStatus(container: Docker.Container): Promise<{
  hasChanges: boolean;
  branch: string;
  lastCommit: string;
}> {
  try {
    const status = await execCommand(container, ["git", "status", "--porcelain"], "/app");
    const branch = await execCommand(
      container,
      ["git", "rev-parse", "--abbrev-ref", "HEAD"],
      "/app"
    );
    const lastCommit = await execCommand(
      container,
      ["git", "log", "-1", "--pretty=%B"],
      "/app"
    ).catch(() => "No commits yet");
    
    return {
      hasChanges: status.trim().length > 0,
      branch: branch.trim(),
      lastCommit: lastCommit.trim(),
    };
  } catch (err: any) {
    return {
      hasChanges: false,
      branch: "main",
      lastCommit: "Not initialized",
    };
  }
}

/**
 * Helper to get container by project ID
 */
async function getContainerByProjectId(projectId: string): Promise<Docker.Container | null> {
  const containers = await docker.listContainers({ all: true });
  const containerData = containers.find(c =>
    c.Names?.some(name => name.includes(projectId))
  );
  
  if (!containerData) return null;
  return docker.getContainer(containerData.Id);
}

/**
 * High-level: Save project (commit + push)
 */
export async function saveProjectToGitHub(
  projectId: string,
  repoUrl: string,
  message: string = "Auto-save from QuantumIDE",
  token?: string
): Promise<void> {
  const container = await getContainerByProjectId(projectId);
  if (!container) {
    throw new Error(`Container not found for project ${projectId}`);
  }
  
  await commitChanges(container, message);
  await pushToGitHub(container, repoUrl, "main", token);
}

/**
 * High-level: Load project (clone + install)
 */
export async function loadProjectFromGitHub(
  projectId: string,
  repoUrl: string,
  token?: string
): Promise<void> {
  const container = await getContainerByProjectId(projectId);
  if (!container) {
    throw new Error(`Container not found for project ${projectId}`);
  }
  
  await cloneFromGitHub(container, repoUrl, "main", token);
}
