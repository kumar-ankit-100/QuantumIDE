import Docker from "dockerode";
import path from "path";
import fs from "fs-extra";
import getPort from "get-port";



const docker = new Docker();
const COMMAND_TIMEOUT = 120000; // 2 minutes for regular commands
const PROJECT_INIT_TIMEOUT = 300000; // 5 minutes for project creation

// Store active containers and their cleanup handlers
const activeContainers = new Map<string, {
  container: Docker.Container;
  type: "build" | "dev";
  lastActivity: Date;
}>();

export interface ContainerInfo {
  containerId: string;
  projectId: string;
  status: string;
  type: "build" | "dev";
}

/**
 * Create and start a container for a project
 */
export async function createContainer(
  projectId: string,
  metadata: any
): Promise<Docker.Container> {
  console.log(`[${new Date().toISOString()}] Creating container for project: ${projectId}`);

  const images = await docker.listImages();
  const imageExists = images.some(img => img.RepoTags?.includes("node:20"));
  
  if (!imageExists) {
    console.log(`[${new Date().toISOString()}] Pulling node:20 image...`);
    const stream = await docker.pull("node:20");
    await new Promise((resolve, reject) => {
      docker.modem.followProgress(stream, (err) => {
        if (err) reject(err);
        else resolve(true);
      });
    });
  }

  // Clean up any existing container
  await cleanupContainer(projectId);

  // Create container with port binding for a range of ports
  // Support both Vite (5173-5180) and Next.js (3000-3007)
  const vitePorts = [5173, 5174, 5175, 5176, 5177, 5178, 5179, 5180];
  const nextPorts = [3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007];
  const allPorts = [...vitePorts, ...nextPorts];
  
  const hostPorts: { [key: string]: any } = {};
  const exposedPorts: { [key: string]: {} } = {};
  
  for (const internalPort of allPorts) {
    const hostPort = await getPort({ port: internalPort });
    exposedPorts[`${internalPort}/tcp`] = {};
    hostPorts[`${internalPort}/tcp`] = [{ HostPort: hostPort.toString() }];
    console.log(`Mapping container port ${internalPort} -> host port ${hostPort}`);
  }
  
  // Container has NO bind mounts - files live inside container only
  const container = await docker.createContainer({
    Image: "node:20",
    name: projectId,
    Tty: true,
    WorkingDir: "/app",
    ExposedPorts: exposedPorts,
    HostConfig: {
      Memory: 1024 * 1024 * 1024,
      NanoCpus: 1000000000,
      PortBindings: hostPorts,
      // No Binds - files are container-only, persisted via GitHub
    },
    Env: ["NODE_ENV=development"],
  });

  await container.start();
  
  // Store metadata inside container
  const metadataJson = JSON.stringify(metadata, null, 2);
  await execCommand(
    container,
    ["bash", "-c", `mkdir -p /app && echo '${metadataJson.replace(/'/g, "'\\''")}' > /app/.quantumide-metadata.json`],
    "/app"
  );
  
  // Track container
  activeContainers.set(projectId, {
    container,
    type: "build",
    lastActivity: new Date(),
  });
  

  console.log(`[${new Date().toISOString()}] Container started: ${projectId}`);
  return container;
}

/**
 * Start development server with file watching
 */
export async function startDevServer(
  container: Docker.Container,
  port: number = 5173,
  serverType: "vite" | "nextjs" = "vite"
): Promise<{ container: Docker.Container; hostPort: number }> {
  const projectId = container.id;
  console.log(`[${new Date().toISOString()}] Starting ${serverType} dev server for: ${projectId}`);

  // Get container info
  const info = await container.inspect().catch(() => null);

  if (!info) {
    throw new Error(`Container not found: ${projectId}. You must create it first.`);
  }

  // If container is not running, start it
  if (!info.State.Running) {
    console.log(`[${new Date().toISOString()}] Container exists but not running, starting...`);
    await container.start();
  }

  // Get the host port from container
  const hostPort = await getContainerPort(projectId, port);
  
  if (!hostPort) {
    throw new Error(`No port mapping found for container ${projectId}. Port ${port} should be mapped.`);
  }

  // Start dev server inside container using exec - command depends on server type
  let devCommand: string[];
  
  if (serverType === "nextjs") {
    console.log(`[${new Date().toISOString()}] Running: npm run dev (Next.js) inside container...`);
    // Next.js dev command is already configured with -H 0.0.0.0 in package.json
    devCommand = ["npm", "run", "dev"];
  } else {
    console.log(`[${new Date().toISOString()}] Running: npm run dev (Vite) inside container...`);
    devCommand = ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", port.toString()];
  }

  const exec = await container.exec({
    Cmd: devCommand,
    AttachStdout: true,
    AttachStderr: true,
    WorkingDir: "/app",
  });

  // Start and attach output (optional but useful for logs)
  const stream = await exec.start({ Tty: false });
  if (stream) {
    container.modem.demuxStream(stream, process.stdout, process.stderr);
  }

  console.log(`[${new Date().toISOString()}] Dev server started on host port ${hostPort}`);

  // Track container in your map
  activeContainers.set(projectId, {
    container,
    type: "dev",
    lastActivity: new Date(),
  });

  return { container, hostPort };
}


/**
 * Create React/Vite project in container
 */
export async function createViteProject(container: Docker.Container): Promise<void> {
  console.log(`[${new Date().toISOString()}] Creating Vite React project...`);

  // Initialize package.json
  await execCommand(container, ["npm", "init", "-y"], "/app");
  
  // Install Vite and React dependencies
  console.log(`[${new Date().toISOString()}] Installing Vite dependencies...`);
  await execCommand(
    container,
    [
      "npm", "install",
      "vite@latest",
      "react@latest",
      "react-dom@latest",
      "@vitejs/plugin-react@latest"
    ],
    "/app",
    PROJECT_INIT_TIMEOUT
  );

  // Install dev dependencies
  await execCommand(
    container,
    [
      "npm", "install", "--save-dev",
      "@types/react@latest",
      "@types/react-dom@latest"
    ],
    "/app",
    PROJECT_INIT_TIMEOUT
  );

  // Create project structure
  await execCommand(container, ["mkdir", "-p", "src"], "/app");
  await execCommand(container, ["mkdir", "-p", "public"], "/app");

  // Create vite.config.js
  const viteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173
  }
})`;
  await execCommand(
    container,
    ["bash", "-c", `cat > vite.config.js << 'EOF'\n${viteConfig}\nEOF`],
    "/app"
  );

  // Create index.html
  const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite + React</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`;
  await execCommand(
    container,
    ["bash", "-c", `cat > index.html << 'EOF'\n${indexHtml}\nEOF`],
    "/app"
  );

  // Create src/main.jsx
  const mainJsx = `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`;
  await execCommand(
    container,
    ["bash", "-c", `cat > src/main.jsx << 'EOF'\n${mainJsx}\nEOF`],
    "/app"
  );

  // Create src/App.jsx
  const appJsx = `import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="App">
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.jsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </div>
  )
}

export default App`;
  await execCommand(
    container,
    ["bash", "-c", `cat > src/App.jsx << 'EOF'\n${appJsx}\nEOF`],
    "/app"
  );

  // Create src/App.css
  const appCss = `#root {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

.card {
  padding: 2em;
}

.read-the-docs {
  color: #888;
}`;
  await execCommand(
    container,
    ["bash", "-c", `cat > src/App.css << 'EOF'\n${appCss}\nEOF`],
    "/app"
  );

  // Create src/index.css
  const indexCss = `:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;

  color-scheme: light dark;
  color: rgba(255, 255, 255, 0.87);
  background-color: #242424;

  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

a {
  font-weight: 500;
  color: #646cff;
  text-decoration: inherit;
}
a:hover {
  color: #535bf2;
}

body {
  margin: 0;
  display: flex;
  place-items: center;
  min-width: 320px;
  min-height: 100vh;
}

h1 {
  font-size: 3.2em;
  line-height: 1.1;
}

button {
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 0.6em 1.2em;
  font-size: 1em;
  font-weight: 500;
  font-family: inherit;
  background-color: #1a1a1a;
  cursor: pointer;
  transition: border-color 0.25s;
}
button:hover {
  border-color: #646cff;
}
button:focus,
button:focus-visible {
  outline: 4px auto -webkit-focus-ring-color;
}

@media (prefers-color-scheme: light) {
  :root {
    color: #213547;
    background-color: #ffffff;
  }
  a:hover {
    color: #747bff;
  }
  button {
    background-color: #f9f9f9;
  }
}`;
  await execCommand(
    container,
    ["bash", "-c", `cat > src/index.css << 'EOF'\n${indexCss}\nEOF`],
    "/app"
  );

  // Update package.json with scripts
  await execCommand(
    container,
    ["bash", "-c", `npm pkg set scripts.dev="vite" scripts.build="vite build" scripts.preview="vite preview"`],
    "/app"
  );

  console.log(`[${new Date().toISOString()}] Vite project setup complete (inside container at /app)`);
}

/**
 * Create Next.js project in container
 */
export async function createNextJSProject(container: Docker.Container): Promise<void> {
  console.log(`[${new Date().toISOString()}] Creating Next.js project...`);

  // Initialize package.json first
  await execCommand(container, ["npm", "init", "-y"], "/app");
  
  // Install Next.js and dependencies directly (faster than create-next-app)
  console.log(`[${new Date().toISOString()}] Installing Next.js dependencies...`);
  await execCommand(
    container,
    [
      "npm", "install", 
      "next@latest", 
      "react@latest", 
      "react-dom@latest",
      "typescript",
      "@types/react",
      "@types/node",
      "tailwindcss",
      "postcss",
      "autoprefixer",
      "eslint",
      "eslint-config-next"
    ],
    "/app",
    PROJECT_INIT_TIMEOUT
  );

  console.log(`[${new Date().toISOString()}] Next.js dependencies installed`);

  // Create project structure
  await execCommand(container, ["mkdir", "-p", "src/app"], "/app");
  await execCommand(container, ["mkdir", "-p", "public"], "/app");

  // Create tsconfig.json
  const tsConfig = `{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}`;

  await writeFileToContainer(container, "tsconfig.json", tsConfig);

  // Create next.config.js
  const nextConfig = `/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

module.exports = nextConfig;`;

  await writeFileToContainer(container, "next.config.js", nextConfig);

  // Create tailwind.config.ts
  const tailwindConfig = `import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
export default config;`;

  await writeFileToContainer(container, "tailwind.config.ts", tailwindConfig);

  // Create postcss.config.js
  const postcssConfig = `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};`;

  await writeFileToContainer(container, "postcss.config.js", postcssConfig);

  // Create src/app/layout.tsx
  const layout = `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QuantumIDE Next.js App",
  description: "Created with QuantumIDE",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}`;

  await writeFileToContainer(container, "src/app/layout.tsx", layout);

  // Create src/app/page.tsx
  const page = `export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-4">Welcome to Next.js on QuantumIDE</h1>
        <p className="text-xl">Start editing src/app/page.tsx to see changes!</p>
      </div>
    </main>
  );
}`;

  await writeFileToContainer(container, "src/app/page.tsx", page);

  // Create src/app/globals.css
  const globalsCss = `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --foreground-rgb: 0, 0, 0;
  --background-start-rgb: 214, 219, 220;
  --background-end-rgb: 255, 255, 255;
}

@media (prefers-color-scheme: dark) {
  :root {
    --foreground-rgb: 255, 255, 255;
    --background-start-rgb: 0, 0, 0;
    --background-end-rgb: 0, 0, 0;
  }
}

body {
  color: rgb(var(--foreground-rgb));
  background: linear-gradient(
      to bottom,
      transparent,
      rgb(var(--background-end-rgb))
    )
    rgb(var(--background-start-rgb));
}`;

  await writeFileToContainer(container, "src/app/globals.css", globalsCss);

  // Update package.json with proper scripts
  const packageJson = `{
  "name": "nextjs-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -H 0.0.0.0",
    "build": "next build",
    "start": "next start -H 0.0.0.0",
    "lint": "next lint"
  }
}`;

  await writeFileToContainer(container, "package.json", packageJson);

  // Reinstall to update package-lock.json with scripts
  await execCommand(container, ["npm", "install"], "/app", 60000);

  console.log(`[${new Date().toISOString()}] Next.js project setup complete!`);
}

/**
 * Create Node.js Express API project in container
 */
export async function createNodeExpressProject(container: Docker.Container): Promise<void> {
  console.log(`[${new Date().toISOString()}] Creating Node.js Express project...`);

  // Initialize package.json
  await execCommand(
    container,
    ["bash", "-c", "npm init -y"],
    "/app"
  );

  // Install dependencies
  await execCommand(
    container,
    ["npm", "install", "express", "cors", "dotenv", "helmet", "morgan"],
    "/app"
  );

  // Install dev dependencies
  await execCommand(
    container,
    ["npm", "install", "--save-dev", "@types/node", "@types/express", "typescript", "ts-node", "nodemon", "eslint", "@typescript-eslint/parser", "@typescript-eslint/eslint-plugin"],
    "/app"
  );

  // Create basic Express server structure
  const serverCode = `import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Express API!' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err: any, req: any, res: any, next: any) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});
`;

  const tsConfig = `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}`;

  const packageJsonUpdate = `{
  "name": "express-api",
  "version": "1.0.0",
  "description": "Express.js API with TypeScript",
  "main": "dist/index.js",
  "scripts": {
    "start": "node dist/index.js",
    "dev": "nodemon src/index.ts",
    "build": "tsc",
    "lint": "eslint src/**/*.ts"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "helmet": "^7.1.0",
    "morgan": "^1.10.0"
  },
  "devDependencies": {
    "@types/node": "^20.8.0",
    "@types/express": "^4.17.20",
    "typescript": "^5.2.2",
    "ts-node": "^10.9.1",
    "nodemon": "^3.0.1",
    "eslint": "^8.51.0",
    "@typescript-eslint/parser": "^6.7.4",
    "@typescript-eslint/eslint-plugin": "^6.7.4"
  }
}`;

  // Create directory structure and files
  await execCommand(container, ["mkdir", "-p", "src"], "/app");
  
  await writeFileToContainer(container, "src/index.ts", serverCode);
  await writeFileToContainer(container, "tsconfig.json", tsConfig);
  await writeFileToContainer(container, "package.json", packageJsonUpdate);
  await writeFileToContainer(container, ".env", "PORT=3000\nNODE_ENV=development");

  console.log(`[${new Date().toISOString()}] Installing updated dependencies...`);
  await execCommand(container, ["npm", "install"], "/app");

  console.log(`[${new Date().toISOString()}] Node.js Express project setup complete (inside container at /app)`);
}

/**
 * Create Vanilla JavaScript project in container
 */
export async function createVanillaJSProject(container: Docker.Container): Promise<void> {
  console.log(`[${new Date().toISOString()}] Creating Vanilla JavaScript project...`);

  await execCommand(
    container,
    ["bash", "-c", "npm init -y"],
    "/app"
  );

  // Install development dependencies
  await execCommand(
    container,
    ["npm", "install", "--save-dev", "vite", "eslint"],
    "/app"
  );

  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vanilla JavaScript App</title>
    <link rel="stylesheet" href="./src/style.css">
</head>
<body>
    <div id="app">
        <h1>Hello, Vanilla JavaScript!</h1>
        <p>This is a modern vanilla JavaScript application.</p>
        <button id="clickBtn">Click me!</button>
        <p id="counter">Clicks: 0</p>
    </div>
    <script type="module" src="./src/main.js"></script>
</body>
</html>`;

  const mainJs = `let clickCount = 0;

function updateCounter() {
    const counter = document.getElementById('counter');
    counter.textContent = \`Clicks: \${clickCount}\`;
}

function handleClick() {
    clickCount++;
    updateCounter();
    console.log(\`Button clicked \${clickCount} times\`);
}

// Initialize the app
function init() {
    const button = document.getElementById('clickBtn');
    button.addEventListener('click', handleClick);
    
    console.log('Vanilla JavaScript app initialized!');
}

// Run when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
`;

  const css = `* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
}

#app {
    background: white;
    padding: 2rem;
    border-radius: 10px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    text-align: center;
    max-width: 400px;
}

h1 {
    color: #333;
    margin-bottom: 1rem;
}

p {
    color: #666;
    margin-bottom: 1rem;
}

button {
    background: #667eea;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 5px;
    cursor: pointer;
    font-size: 1rem;
    transition: background 0.3s ease;
}

button:hover {
    background: #5a6fd8;
}

#counter {
    margin-top: 1rem;
    font-weight: bold;
    color: #333;
}`;

  const packageJsonUpdate = `{
  "name": "vanilla-js-app",
  "version": "1.0.0",
  "description": "Modern Vanilla JavaScript application",
  "main": "src/main.js",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint src/**/*.js"
  },
  "devDependencies": {
    "vite": "^4.4.9",
    "eslint": "^8.51.0"
  }
}`;

  // Create directory structure and files
  await execCommand(container, ["mkdir", "-p", "src"], "/app");
  
  await writeFileToContainer(container, "index.html", indexHtml);
  await writeFileToContainer(container, "src/main.js", mainJs);
  await writeFileToContainer(container, "src/style.css", css);
  await writeFileToContainer(container, "package.json", packageJsonUpdate);

  console.log(`[${new Date().toISOString()}] Installing dependencies...`);
  await execCommand(container, ["npm", "install"], "/app");

  console.log(`[${new Date().toISOString()}] Vanilla JavaScript project setup complete (inside container at /app)`);
}

/**
 * Verify files exist inside container (for cloud IDE architecture)
 */
export async function verifyContainerFiles(container: Docker.Container): Promise<boolean> {
  try {
    const output = await execCommand(container, ["ls", "-la", "/app"], "/app");
    console.log(`[${new Date().toISOString()}] Container files:`, output);
    
    // Check for package.json - key indicator of successful setup
    // Also check for common project files (vite.config, next.config, index.html, src/)
    const hasPackageJson = output.includes("package.json");
    const hasProjectFiles = output.includes("vite.config") || 
                           output.includes("next.config") || 
                           output.includes("index.html") ||
                           output.includes("src");
    
    return hasPackageJson && hasProjectFiles;
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Failed to verify container files:`, err);
    return false;
  }
}

/**
 * Get list of files inside container /app
 */
export async function listContainerFiles(container: Docker.Container): Promise<string[]> {
  try {
    const output = await execCommand(container, ["ls", "-1", "/app"], "/app");
    return output.split("\n").filter(line => line.trim().length > 0);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Failed to list container files:`, err);
    return [];
  }
}

/**
 * Read file content from container
 */
export async function readFileFromContainer(
  container: Docker.Container,
  filePath: string
): Promise<string> {
  try {
    const fullPath = filePath.startsWith('/') ? filePath : `/app/${filePath}`;
    const output = await execCommand(container, ["cat", fullPath], "/app");
    return output;
  } catch (err: any) {
    throw new Error(`Failed to read file ${filePath}: ${err.message}`);
  }
}

/**
 * Write file content to container
 */
export async function writeFileToContainer(
  container: Docker.Container,
  filePath: string,
  content: string
): Promise<void> {
  try {
    const fullPath = filePath.startsWith('/') ? filePath : `/app/${filePath}`;
    // Use bash to write content (escape single quotes in content)
    const escapedContent = content.replace(/'/g, "'\\''");
    await execCommand(
      container,
      ["bash", "-c", `echo '${escapedContent}' > ${fullPath}`],
      "/app"
    );
  } catch (err: any) {
    throw new Error(`Failed to write file ${filePath}: ${err.message}`);
  }
}

/**
 * Get file tree from container
 */
export async function getContainerFileTree(
  container: Docker.Container,
  directory: string = "/app"
): Promise<any> {
  try {
    // Use find to get recursive file listing with type
    const output = await execCommand(
      container,
      ["find", directory, "-maxdepth", "3", "-type", "f", "-o", "-type", "d"],
      directory
    );
    
    const lines = output.split("\n").filter(line => line.trim().length > 0);
    const rootNode: any = { name: "app", type: "directory", path: "/app", children: [] };
    
    // Build file tree structure
    const pathMap = new Map<string, any>();
    pathMap.set(directory, rootNode);
    
    for (const fullPath of lines) {
      if (fullPath === directory) continue;
      
      const relativePath = fullPath.replace(directory + "/", "");
      const parts = relativePath.split("/");
      const fileName = parts[parts.length - 1];
      
      // Skip node_modules and hidden files
      if (relativePath.includes("node_modules") || fileName.startsWith(".")) {
        continue;
      }
      
      // Determine if it's a directory by checking if it has children in the list
      const isDirectory = lines.some(p => p.startsWith(fullPath + "/"));
      
      const node: any = {
        name: fileName,
        type: isDirectory ? "directory" : "file",
        path: relativePath,
        children: isDirectory ? [] : undefined,
      };
      
      // Find parent directory
      let parentPath = directory;
      if (parts.length > 1) {
        parentPath = directory + "/" + parts.slice(0, -1).join("/");
      }
      
      const parent = pathMap.get(parentPath);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(node);
      }
      
      pathMap.set(fullPath, node);
    }
    
    return rootNode;
  } catch (err: any) {
    console.error(`[${new Date().toISOString()}] Failed to get file tree:`, err);
    return { name: "app", type: "directory", path: "/app", children: [] };
  }
}

/**
 * Get exposed port mapping for container
 */
export async function getContainerPort(
  containerId: string,
  internalPort: number = 5173
): Promise<number | null> {
  try {
    const container = docker.getContainer(containerId);
    const info = await container.inspect();
    
    const portKey = `${internalPort}/tcp`;
    const portBindings = info.NetworkSettings?.Ports?.[portKey];
    
    if (portBindings && portBindings.length > 0) {
      return parseInt(portBindings[0].HostPort, 10);
    }
    
    return null;
  } catch (err: any) {
    console.error(`[${new Date().toISOString()}] Failed to get container port:`, err);
    return null;
  }
}

/**
 * Execute command in container
 */
export async function execCommand(
  container: Docker.Container,
  command: string[],
  workingDir: string = "/app",
  customTimeout?: number
): Promise<string> {
  const timeoutMs = customTimeout || COMMAND_TIMEOUT;
  console.log(`[${new Date().toISOString()}] Executing: ${command.join(" ")} (timeout: ${timeoutMs / 1000}s)`);

  const exec = await container.exec({
    Cmd: command,
    AttachStdout: true,
    AttachStderr: true,
    Tty: false,
    WorkingDir: workingDir,
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Command timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    exec.start({ hijack: true, stdin: false }, (err, stream) => {
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

      let output = "";
      
      // Handle data events directly
      stream.on("data", (chunk: Buffer) => {
        output += chunk.toString();
      });

      stream.on("end", () => {
        clearTimeout(timeout);
        // Strip Docker stream headers (8 bytes per frame)
        const cleaned = output.replace(/[\x00-\x08]/g, '');
        resolve(cleaned);
      });
      
      stream.on("error", (streamErr: Error) => {
        clearTimeout(timeout);
        reject(streamErr);
      });
    });
  });
}

/**
 * Stop container and sync to S3
 */
export async function stopAndRemoveContainer(container: Docker.Container): Promise<void> {
  try {
    await container.stop({ t: 10 });
  } catch (err: any) {
    console.warn(`Warning: ${err.message}`);
  }

  try {
    await container.remove({ force: true });
  } catch (err: any) {
    console.warn(`Warning: ${err.message}`);
  }
}

/**
 * Cleanup container and sync to S3
 */
export async function cleanupContainer(containerName: string): Promise<void> {
  const allContainers = await docker.listContainers({ all: true });
  const existing = allContainers.find(c =>
    c.Names.some(name => name === `/${containerName}`)
  );
  
  if (existing) {
    const container = docker.getContainer(existing.Id);
    await stopAndRemoveContainer(container);
  }

  activeContainers.delete(containerName);
}

/**
 * Cleanup project completely (container only - Git handles persistence)
 */
export async function cleanupProject(
  projectId: string,
  projectFolder: string,
  deleteLocalFiles: boolean = false
): Promise<void> {
  console.log(`[${new Date().toISOString()}] Cleaning up project: ${projectId}`);

  // Cleanup build container
  await cleanupContainer(projectId);
  
  // Cleanup dev container
  await cleanupContainer(`${projectId}-dev`);

  // Optionally delete local metadata folder
  if (deleteLocalFiles && await fs.pathExists(projectFolder)) {
    await fs.remove(projectFolder);
    console.log(`[${new Date().toISOString()}] Deleted local project folder`);
  }
}

/**
 * Get container status
 */
export async function getContainerStatus(containerName: string): Promise<string | null> {
  const containers = await docker.listContainers({ all: true });
  const container = containers.find(c =>
    c.Names?.some(name => name.includes(containerName))
  );
  
//   console.log(`[${new Date().toISOString()}] Queried status for container:`, container?.Names);

  return container ? container.State : null;
}


/**
 * List all active project containers
 */
export async function listProjectContainers(): Promise<ContainerInfo[]> {
  const containers = await docker.listContainers({ all: true });
  
  return containers.map(c => ({
    containerId: c.Id,
    projectId: c.Names[0]?.replace("/", "") || "unknown",
    status: c.State,
    type: c.Names[0]?.includes("-dev") ? "dev" : "build",
  }));
}

/**
 * Update container activity timestamp
 */
export function updateContainerActivity(containerName: string): void {
  const info = activeContainers.get(containerName);
  if (info) {
    info.lastActivity = new Date();
  }
}

/**
 * Auto-cleanup inactive containers (run periodically)
 */
export async function cleanupInactiveContainers(maxIdleMinutes: number = 30): Promise<void> {
  const now = new Date();
  
  for (const [name, info] of activeContainers.entries()) {
    const idleMinutes = (now.getTime() - info.lastActivity.getTime()) / (1000 * 60);
    
    if (idleMinutes > maxIdleMinutes) {
      console.log(`[${new Date().toISOString()}] Cleaning up inactive container: ${name}`);
      await cleanupContainer(name);
    }
  }
}