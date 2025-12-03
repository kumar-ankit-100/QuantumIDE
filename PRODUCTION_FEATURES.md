# QuantumIDE Production Features

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [GitHub Integration](#github-integration)
3. [Production Features](#production-features)
4. [Scalability](#scalability)
5. [Monitoring & Health](#monitoring--health)
6. [Rate Limiting](#rate-limiting)
7. [Error Handling](#error-handling)
8. [Security](#security)

## Architecture Overview

QuantumIDE is a cloud-based containerized IDE that runs each project in isolated Docker containers. Files are stored **inside containers only** (no bind mounts), with Git/GitHub providing persistence.

### Key Components
- **Frontend**: Next.js 15 with App Router, React 19, Monaco Editor
- **Backend**: Next.js API Routes (App Router)
- **Container Runtime**: Dockerode managing node:20 containers
- **AI**: Google Gemini 2.5 Flash via SSE streaming
- **Database**: Prisma + SQLite (auth/metadata only)
- **Persistence**: Git inside containers → GitHub remote repos
- **UI**: Tailwind CSS 4, shadcn/ui, Radix UI

### Container Architecture
```
┌─────────────────────────────────────┐
│   User Browser (Monaco Editor)      │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│   Next.js API Routes                │
│   - /api/projects/*                 │
│   - /api/ai/chat                    │
│   - /api/ai/edit                    │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│   Dockerode (Docker Control)        │
└─────────────┬───────────────────────┘
              │
         ┌────┴────┬────────┬─────────┐
         ▼         ▼        ▼         ▼
    ┌────────┐ ┌────────┐ ┌────────┐
    │ node:20│ │ node:20│ │ node:20│
    │ /app/* │ │ /app/* │ │ /app/* │
    │  Git   │ │  Git   │ │  Git   │
    └────────┘ └────────┘ └────────┘
      Port        Port      Port
      5173        5174      3000
```

## GitHub Integration

### How It Works
1. **Project Creation**: Initializes Git repo inside container
2. **Active Development**: Files only exist in container (fast operations)
3. **Commit**: User commits changes locally inside container
4. **Push**: User pushes to GitHub (backup + version control)
5. **Load Project**: Clones GitHub repo into new container

### UI Features
- **Dashboard**: "Load from GitHub" button opens modal for cloning repos
- **Editor**: Git status panel shows:
  - Uncommitted changes count
  - Current branch
  - Last commit hash
  - "Commit & Push" button opens connection modal

### API Endpoints
- `POST /api/projects/sync`: Commit and push changes
- `GET /api/projects/sync?projectId=xxx`: Get Git status
- `POST /api/projects/load`: Clone GitHub repo into new container

### Git Commands (Inside Container)
```bash
# Initialization
git init
git config user.name "QuantumIDE"
git config user.email "ide@quantumide.dev"
git add .
git commit -m "Initial commit"

# Persistence
git add .
git commit -m "User commit message"
git remote add origin https://<token>@github.com/user/repo.git
git push -u origin main
```

## Production Features

### 1. Structured Logging
**Location**: `src/lib/logger.ts`

```typescript
import { logger } from '@/lib/logger';

// Logging with context
logger.info("Container created", { containerId, projectId });
logger.warn("Rate limit approaching", { userId, remaining: 2 });
logger.error("Container failed to start", error, { containerId });
logger.debug("File operation", { path, size, operation: "write" });
```

**Features**:
- ISO timestamp on every log
- Structured JSON context
- Stack traces in development only
- Log levels: info, warn, error, debug
- Console output with formatted strings

### 2. Metrics Collection
**Location**: `src/lib/metrics.ts`

```typescript
import { metrics, timeAsync } from '@/lib/metrics';

// Counter metrics
metrics.incrementCounter('containers.created');
metrics.incrementCounter('api.errors', 5);

// Timing metrics (tracks min/max/avg)
metrics.recordTiming('container.startup', 4523); // ms

// Gauge metrics (current value)
metrics.setGauge('containers.running', 12);

// Time async operations
const result = await timeAsync('api.projects.create', async () => {
  return await createProject();
});

// Get all metrics
const data = metrics.getMetrics();
console.log(data);
// {
//   counters: { 'containers.created': { count: 42, lastUpdated: Date } },
//   timings: { 'api.response': { total: 5000, count: 10, min: 200, max: 800, avg: 500 } },
//   gauges: { 'containers.running': 12 }
// }
```

### 3. Error Handling Middleware
**Location**: `src/middleware/withErrorHandler.ts`

Wraps API routes to:
- Log all requests/responses with timing
- Catch and log errors with full context
- Return user-friendly error messages
- Record metrics for success/error rates

```typescript
import { withErrorHandler } from '@/middleware/withErrorHandler';

async function myHandler(request: Request) {
  // Your route logic
}

export const POST = withErrorHandler(myHandler);
```

### 4. Rate Limiting
**Location**: `src/middleware/withRateLimit.ts`, `src/lib/rateLimit.ts`

**Configuration**:
- **Project Creation**: 10 per hour per user
- **AI Requests**: 30 per minute per user
- **File Operations**: No limit (internal only)

```typescript
import { withRateLimit } from '@/middleware/withRateLimit';

async function myHandler(request: Request) {
  // Your route logic
}

export const POST = withRateLimit(myHandler, {
  interval: 60 * 60 * 1000, // 1 hour
  maxRequests: 10,
  identifierFn: (req) => req.headers.get('user-id') || 'anonymous'
});
```

**Response Headers**:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1704067200000
```

**429 Response** (Rate Limit Exceeded):
```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again in 45 seconds.",
  "resetTime": 1704067200000
}
```

### 5. Health Check Endpoint
**Location**: `src/app/api/health/route.ts`

```bash
curl http://localhost:3000/api/health
```

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 3600,
  "docker": {
    "healthy": true,
    "containers": {
      "total": 5,
      "running": 3
    }
  },
  "process": {
    "memory": {
      "rss": 245,
      "heapTotal": 128,
      "heapUsed": 89
    },
    "uptime": 3600
  },
  "metrics": {
    "counters": { ... },
    "timings": { ... },
    "gauges": { ... }
  },
  "responseTime": 12
}
```

**Status Codes**:
- `200`: Everything healthy
- `503`: Docker unhealthy or degraded

## Scalability

### Container Resource Limits
**Location**: `src/lib/containerManager.ts`

Each container is created with:
```typescript
HostConfig: {
  Memory: 512 * 1024 * 1024, // 512 MB RAM
  NanoCpus: 1 * 1e9,         // 1 CPU core
  AutoRemove: false,
  PortBindings: { ... }
}
```

### Port Pooling
Dynamic port allocation prevents conflicts:
- **Vite projects**: 5173-5180 (8 concurrent projects)
- **Next.js projects**: 3000-3007 (8 concurrent projects)

Handled by `get-port` library with retry logic.

### Timeout Configuration
```typescript
// containerManager.ts
const COMMAND_TIMEOUT = 120000;         // 2 minutes (default)
const PROJECT_INIT_TIMEOUT = 300000;    // 5 minutes (project creation)
```

### Container Cleanup Strategy
- **Automatic**: `AutoRemove: false` allows graceful cleanup
- **On Stop**: Commits changes to Git before removal
- **Failed Projects**: Cleanup attempted even on creation errors
- **Scheduled**: Can add cron job to clean up stale containers (>24h inactive)

### Future Scalability Improvements

#### 1. Container Pooling
Pre-warm containers with base image to reduce startup time:
```typescript
// Maintain pool of 3 ready containers
const containerPool = new ContainerPool({
  min: 3,
  max: 10,
  idleTimeout: 5 * 60 * 1000 // 5 minutes
});

// Get container from pool instead of creating new
const container = await containerPool.acquire();
```

#### 2. Queue System
Use Bull or BullMQ for background tasks:
```typescript
import Queue from 'bull';

const projectQueue = new Queue('projects', {
  redis: { host: 'localhost', port: 6379 }
});

// Create project in background
projectQueue.add('create', { template, name, userId });

// Worker processes jobs
projectQueue.process('create', async (job) => {
  await createProject(job.data);
});
```

#### 3. Distributed Docker
Multi-host Docker setup with Docker Swarm:
```typescript
const docker = new Docker({
  host: process.env.DOCKER_HOST,
  port: 2375
});

// Route projects to least-loaded host
const host = await loadBalancer.getLeastLoadedHost();
```

#### 4. Database Migration
Move from SQLite to PostgreSQL for production:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

#### 5. Redis for Session/Rate Limiting
Replace in-memory stores:
```typescript
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

// Distributed rate limiting
const key = `ratelimit:${userId}:${endpoint}`;
const count = await redis.incr(key);
if (count === 1) {
  await redis.expire(key, 3600);
}
```

## Monitoring & Health

### Metrics Available
1. **Container Metrics**:
   - `containers.total`: Total containers (stopped + running)
   - `containers.running`: Currently running containers
   - `containers.created`: Cumulative creation count
   - `container.startup`: Startup time distribution

2. **API Metrics**:
   - `api.{method}.{path}.success`: Successful request count
   - `api.{method}.{path}.error`: Failed request count
   - `api.{method}.{path}`: Response time distribution

3. **Process Metrics**:
   - Memory usage (RSS, heap)
   - Uptime
   - CPU usage (via external monitoring)

### Monitoring Best Practices
1. **Health Check**: Poll `/api/health` every 30s
2. **Alerts**: Set up alerts for:
   - Docker health failures
   - Container count > 50 (resource exhaustion)
   - API response time > 5s (p95)
   - Rate limit rejections (potential attack)
3. **Dashboards**: Visualize metrics with Grafana/Prometheus
4. **Log Aggregation**: Send logs to CloudWatch/Datadog

## Rate Limiting

### Current Limits
| Endpoint | Limit | Window | Identifier |
|----------|-------|--------|------------|
| POST /api/projects/create | 10 | 1 hour | IP address |
| POST /api/ai/chat | 30 | 1 minute | IP address |
| POST /api/ai/edit | 30 | 1 minute | IP address |

### Implementation Details
- **Storage**: In-memory Map (fast, but not distributed)
- **Cleanup**: Automatic garbage collection every 60s
- **Identifier**: `X-Forwarded-For` header or 'anonymous'
- **Algorithm**: Fixed window counter

### Testing Rate Limits
```bash
# Test project creation rate limit
for i in {1..15}; do
  curl -X POST http://localhost:3000/api/projects/create \
    -H "Content-Type: application/json" \
    -d '{"template":"react-vite"}' &
done

# Watch for 429 responses after 10 requests
```

### Customizing Rate Limits
Edit the middleware wrapper in route files:
```typescript
export const POST = withRateLimit(handler, {
  interval: 5 * 60 * 1000,  // 5 minutes
  maxRequests: 50,          // 50 requests
  identifierFn: (req) => {
    // Use authenticated user ID instead of IP
    return req.headers.get('x-user-id') || 'anonymous';
  }
});
```

## Error Handling

### Error Categories
1. **Container Errors**: Docker daemon issues, image pull failures
2. **File System Errors**: Permission denied, disk full
3. **AI Errors**: API key invalid, quota exceeded, timeout
4. **Network Errors**: Connection refused, timeout
5. **Validation Errors**: Invalid input, missing required fields

### Error Logging
All errors are logged with:
- **Timestamp**: ISO 8601 format
- **Error message**: User-friendly description
- **Stack trace**: Development only
- **Context**: Request details, user ID, container ID

```typescript
logger.error("Container creation failed", error, {
  projectId: "3b5ee27e-...",
  template: "nextjs",
  userId: "user-123"
});
```

### Error Responses
**Development**:
```json
{
  "error": "Internal server error",
  "message": "Cannot connect to Docker daemon at unix:///var/run/docker.sock"
}
```

**Production**:
```json
{
  "error": "Internal server error",
  "message": "An unexpected error occurred"
}
```

### Graceful Degradation
- **Docker Down**: Return 503 with health check results
- **AI Unavailable**: Disable AI features, allow file editing
- **Git Fails**: Warn user but allow container operations

## Security

### Current Measures
1. **No Bind Mounts**: Files only in containers (isolation)
2. **Resource Limits**: 512MB RAM, 1 CPU per container
3. **Rate Limiting**: Prevents abuse/DoS
4. **API Key Security**: Gemini key in env vars only
5. **GitHub Tokens**: Passed at runtime, not stored

### Production Recommendations
1. **Authentication**:
   ```typescript
   import { getServerSession } from "next-auth";
   
   const session = await getServerSession();
   if (!session) {
     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
   }
   ```

2. **HTTPS Enforcement**:
   ```typescript
   // middleware.ts
   if (request.headers.get('x-forwarded-proto') !== 'https') {
     return NextResponse.redirect(
       `https://${request.headers.get('host')}${request.nextUrl.pathname}`
     );
   }
   ```

3. **CORS Configuration**:
   ```typescript
   // next.config.ts
   async headers() {
     return [
       {
         source: '/api/:path*',
         headers: [
           { key: 'Access-Control-Allow-Origin', value: 'https://yourdomain.com' },
         ],
       },
     ];
   }
   ```

4. **Docker Socket Security**:
   - Run Docker in rootless mode
   - Use Docker Socket Proxy
   - Restrict API access with TLS

5. **Input Validation**:
   ```typescript
   import { z } from 'zod';
   
   const CreateProjectSchema = z.object({
     template: z.enum(['nextjs', 'react-vite', 'node-express', 'vanilla-js']),
     name: z.string().min(1).max(100),
     description: z.string().max(500).optional(),
   });
   
   const body = CreateProjectSchema.parse(await request.json());
   ```

## Getting Started

### Environment Variables
```bash
# .env.local
GEMINI_API_KEY=your_gemini_api_key
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET=your_secret_key
NEXTAUTH_URL=http://localhost:3000
```

### Running Locally
```bash
npm install
npx prisma generate
npm run dev
```

### Docker Requirements
- Docker daemon running
- Docker socket accessible: `/var/run/docker.sock`
- Image pre-pulled: `docker pull node:20`

### Testing Features
1. **Health Check**: `curl http://localhost:3000/api/health`
2. **Create Project**: Use dashboard UI or POST to `/api/projects/create`
3. **Test Git**: Create project, edit files, click "Commit & Push"
4. **Load Project**: Click "Load from GitHub" on dashboard
5. **Rate Limiting**: Send 15 rapid requests to `/api/projects/create`

---

**Last Updated**: January 2024  
**Version**: 1.0.0  
**Maintainer**: QuantumIDE Team
