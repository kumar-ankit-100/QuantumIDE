// lib/rateLimit.ts - Simple rate limiting for API routes
interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

export interface RateLimitConfig {
  interval: number; // milliseconds
  maxRequests: number;
}

export function rateLimit(config: RateLimitConfig) {
  return {
    check: (identifier: string): { success: boolean; remaining: number; reset: number } => {
      const now = Date.now();
      const key = identifier;

      // Initialize or reset if expired
      if (!store[key] || now > store[key].resetTime) {
        store[key] = {
          count: 0,
          resetTime: now + config.interval,
        };
      }

      const data = store[key];
      
      // Check if limit exceeded
      if (data.count >= config.maxRequests) {
        return {
          success: false,
          remaining: 0,
          reset: data.resetTime,
        };
      }

      // Increment and allow
      data.count++;
      
      return {
        success: true,
        remaining: config.maxRequests - data.count,
        reset: data.resetTime,
      };
    },
  };
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  Object.keys(store).forEach((key) => {
    if (now > store[key].resetTime + 60000) { // Clean up 1 minute after reset
      delete store[key];
    }
  });
}, 60000); // Run every minute
