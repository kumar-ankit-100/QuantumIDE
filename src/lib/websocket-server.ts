import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import Docker from 'dockerode';

const docker = new Docker();

interface Client {
  ws: WebSocket;
  projectId: string;
  subscriptions: Set<string>;
}

const clients = new Map<string, Set<Client>>();
const portCache = new Map<string, { port: number; hostPort: number; url: string }>();

export function setupWebSocketServer(server: HTTPServer) {
  const wss = new WebSocketServer({ 
    server,
    path: '/api/ws'
  });

  console.log('[WebSocket] Server initialized on /api/ws');

  wss.on('connection', (ws: WebSocket, req) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const projectId = url.searchParams.get('projectId');

    if (!projectId) {
      ws.close(1008, 'Missing projectId parameter');
      return;
    }

    const client: Client = {
      ws,
      projectId,
      subscriptions: new Set()
    };

    // Add client to project room
    if (!clients.has(projectId)) {
      clients.set(projectId, new Set());
    }
    clients.get(projectId)!.add(client);

    console.log(`[WebSocket] Client connected to project ${projectId}`);

    // Send initial connection message
    ws.send(JSON.stringify({
      type: 'connected',
      projectId,
      timestamp: Date.now()
    }));

    // Handle messages from client
    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());

        switch (message.type) {
          case 'subscribe':
            handleSubscribe(client, message.channel);
            break;
          case 'unsubscribe':
            handleUnsubscribe(client, message.channel);
            break;
          case 'ping':
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            break;
          default:
            console.warn(`[WebSocket] Unknown message type: ${message.type}`);
        }
      } catch (error) {
        console.error('[WebSocket] Error handling message:', error);
      }
    });

    // Handle disconnection
    ws.on('close', () => {
      const projectClients = clients.get(projectId);
      if (projectClients) {
        projectClients.delete(client);
        if (projectClients.size === 0) {
          clients.delete(projectId);
        }
      }
      console.log(`[WebSocket] Client disconnected from project ${projectId}`);
    });

    ws.on('error', (error) => {
      console.error('[WebSocket] Error:', error);
    });
  });

  // Start monitoring tasks
  startPortMonitoring();

  return wss;
}

function handleSubscribe(client: Client, channel: string) {
  client.subscriptions.add(channel);

  // Send cached data immediately if available
  if (channel === 'port') {
    const cached = portCache.get(client.projectId);
    if (cached) {
      client.ws.send(JSON.stringify({
        type: 'port_update',
        ...cached,
        timestamp: Date.now()
      }));
    }
  }
}

function handleUnsubscribe(client: Client, channel: string) {
  client.subscriptions.delete(channel);
}

// Monitor port changes (only check when there are active clients)
function startPortMonitoring() {
  setInterval(async () => {
    const projectIds = Array.from(clients.keys());

    for (const projectId of projectIds) {
      try {
        const container = docker.getContainer(projectId);
        const inspect = await container.inspect();

        if (!inspect.State.Running) continue;

        // Check for active dev server in logs
        const logExec = await container.exec({
          Cmd: ['sh', '-c', 'cat /tmp/dev-server.log 2>/dev/null | tail -10'],
          AttachStdout: true,
          AttachStderr: false,
        });

        const logStream = await logExec.start({ Detach: false, Tty: false });
        let logOutput = '';

        logStream.on('data', (chunk: Buffer) => {
          logOutput += chunk.toString();
        });

        await new Promise((resolve) => {
          logStream.on('end', resolve);
          setTimeout(resolve, 500);
        });

        // Detect port from logs
        const portMatch = logOutput.match(/localhost:(\d+)/i);
        if (portMatch) {
          const detectedPort = parseInt(portMatch[1]);
          const portBindings = inspect.NetworkSettings?.Ports || {};
          const portKey = `${detectedPort}/tcp`;

          if (portBindings[portKey] && portBindings[portKey].length > 0) {
            const hostPort = parseInt(portBindings[portKey][0].HostPort);
            const portData = {
              port: detectedPort,
              hostPort,
              url: `http://localhost:${hostPort}`
            };

            // Only broadcast if changed
            const cached = portCache.get(projectId);
            if (!cached || cached.port !== detectedPort || cached.hostPort !== hostPort) {
              portCache.set(projectId, portData);
              broadcastToProject(projectId, 'port', {
                type: 'port_update',
                ...portData,
                timestamp: Date.now()
              });
            }
          }
        }
      } catch (error) {
        // Container might be stopped or deleted
      }
    }
  }, 5000); // Check every 5 seconds instead of 3 (less aggressive)
}

// Broadcast message to all clients subscribed to a channel in a project
function broadcastToProject(projectId: string, channel: string, message: any) {
  const projectClients = clients.get(projectId);
  if (!projectClients) return;

  const data = JSON.stringify(message);
  let sent = 0;

  projectClients.forEach((client) => {
    if (client.subscriptions.has(channel) && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
      sent++;
    }
  });

  // Only log on first broadcast or significant events
  // Removed to reduce log spam
}

// Public API for broadcasting from other parts of the app
export function broadcastPortUpdate(projectId: string, portData: { port: number; hostPort: number; url: string }) {
  portCache.set(projectId, portData);
  broadcastToProject(projectId, 'port', {
    type: 'port_update',
    ...portData,
    timestamp: Date.now()
  });
}

export function broadcastFileChange(projectId: string, filePath: string, action: 'created' | 'modified' | 'deleted') {
  broadcastToProject(projectId, 'files', {
    type: 'file_change',
    filePath,
    action,
    timestamp: Date.now()
  });
}
