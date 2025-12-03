// middleware/withRateLimit.ts - Rate limiting middleware for API routes
import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rateLimit';
import { logger } from '@/lib/logger';

interface RateLimitConfig {
  interval: number;
  maxRequests: number;
  identifierFn?: (request: Request) => string;
}

type ApiHandler = (
  request: Request,
  context?: any
) => Promise<Response>;

export function withRateLimit(
  handler: ApiHandler,
  config: RateLimitConfig
): ApiHandler {
  const limiter = rateLimit({
    interval: config.interval,
    maxRequests: config.maxRequests,
  });

  return async (request: Request, context?: any) => {
    const identifier = config.identifierFn 
      ? config.identifierFn(request)
      : request.headers.get('x-forwarded-for') || 'anonymous';

    const result = limiter.check(identifier);

    if (!result.success) {
      logger.warn('Rate limit exceeded', {
        identifier,
        path: new URL(request.url).pathname,
        resetTime: result.reset,
      });

      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again in ${Math.ceil((result.reset - Date.now()) / 1000)} seconds.`,
          resetTime: result.reset,
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': config.maxRequests.toString(),
            'X-RateLimit-Remaining': result.remaining.toString(),
            'X-RateLimit-Reset': result.reset.toString(),
          }
        }
      );
    }

    const response = await handler(request, context);
    
    // Add rate limit headers to successful responses
    response.headers.set('X-RateLimit-Limit', config.maxRequests.toString());
    response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
    response.headers.set('X-RateLimit-Reset', result.reset.toString());
    
    return response;
  };
}
