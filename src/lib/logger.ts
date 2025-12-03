// lib/logger.ts - Production-ready logging
type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, any>;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  private formatLog(entry: LogEntry): string {
    return `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}${
      entry.context ? ` ${JSON.stringify(entry.context)}` : ''
    }`;
  }

  info(message: string, context?: Record<string, any>) {
    const entry: LogEntry = {
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      context,
    };
    console.log(this.formatLog(entry));
  }

  warn(message: string, context?: Record<string, any>) {
    const entry: LogEntry = {
      level: 'warn',
      message,
      timestamp: new Date().toISOString(),
      context,
    };
    console.warn(this.formatLog(entry));
  }

  error(message: string, error?: Error, context?: Record<string, any>) {
    const entry: LogEntry = {
      level: 'error',
      message,
      timestamp: new Date().toISOString(),
      context: {
        ...context,
        error: error ? {
          message: error.message,
          stack: this.isDevelopment ? error.stack : undefined,
        } : undefined,
      },
    };
    console.error(this.formatLog(entry));
  }

  debug(message: string, context?: Record<string, any>) {
    if (!this.isDevelopment) return;
    
    const entry: LogEntry = {
      level: 'debug',
      message,
      timestamp: new Date().toISOString(),
      context,
    };
    console.debug(this.formatLog(entry));
  }
}

export const logger = new Logger();
