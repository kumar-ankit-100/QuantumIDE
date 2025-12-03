// middleware/withErrorHandler.ts - Wraps API routes with comprehensive error handling
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { metrics } from '@/lib/metrics';

type ApiHandler = (
  request: Request,
  context?: any
) => Promise<Response>;

export function withErrorHandler(handler: ApiHandler): ApiHandler {
  return async (request: Request, context?: any) => {
    const start = Date.now();
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      logger.info(`API Request: ${request.method} ${path}`);
      
      const response = await handler(request, context);
      
      const duration = Date.now() - start;
      metrics.recordTiming(`api.${request.method}.${path}`, duration);
      metrics.incrementCounter(`api.${request.method}.${path}.success`);
      
      logger.info(`API Response: ${request.method} ${path} - ${response.status}`, {
        duration,
        status: response.status,
      });
      
      return response;
    } catch (error) {
      const duration = Date.now() - start;
      metrics.recordTiming(`api.${request.method}.${path}`, duration);
      metrics.incrementCounter(`api.${request.method}.${path}.error`);
      
      logger.error(`API Error: ${request.method} ${path}`, error as Error, {
        duration,
      });
      
      return NextResponse.json(
        {
          error: 'Internal server error',
          message: process.env.NODE_ENV === 'development' 
            ? (error as Error).message 
            : 'An unexpected error occurred',
        },
        { status: 500 }
      );
    }
  };
}
