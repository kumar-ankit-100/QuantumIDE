// app/api/health/route.ts - Health check endpoint for monitoring
import { NextResponse } from 'next/server';
import { metrics } from '@/lib/metrics';
import Docker from 'dockerode';

const docker = new Docker();

export async function GET() {
  try {
    const start = Date.now();
    
    // Check Docker connection
    let dockerHealthy = false;
    try {
      await docker.ping();
      dockerHealthy = true;
    } catch (err) {
      console.error('Docker ping failed:', err);
    }

    // Get container stats
    let containerCount = 0;
    let runningContainers = 0;
    try {
      const containers = await docker.listContainers({ all: true });
      containerCount = containers.length;
      runningContainers = containers.filter(c => c.State === 'running').length;
    } catch (err) {
      console.error('Failed to list containers:', err);
    }

    // Get metrics
    const metricsData = metrics.getMetrics();

    // Update gauge metrics
    metrics.setGauge('containers.total', containerCount);
    metrics.setGauge('containers.running', runningContainers);

    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();

    const health = {
      status: dockerHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptime),
      docker: {
        healthy: dockerHealthy,
        containers: {
          total: containerCount,
          running: runningContainers,
        },
      },
      process: {
        memory: {
          rss: Math.floor(memoryUsage.rss / 1024 / 1024), // MB
          heapTotal: Math.floor(memoryUsage.heapTotal / 1024 / 1024), // MB
          heapUsed: Math.floor(memoryUsage.heapUsed / 1024 / 1024), // MB
        },
        uptime: Math.floor(uptime),
      },
      metrics: metricsData,
      responseTime: Date.now() - start,
    };

    return NextResponse.json(health, {
      status: dockerHealthy ? 200 : 503,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
