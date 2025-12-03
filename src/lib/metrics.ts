// lib/metrics.ts - Simple in-memory metrics for production monitoring
interface Metric {
  count: number;
  lastUpdated: Date;
}

interface TimingMetric {
  total: number;
  count: number;
  min: number;
  max: number;
  avg: number;
}

class MetricsCollector {
  private counters = new Map<string, Metric>();
  private timings = new Map<string, TimingMetric>();
  private gauges = new Map<string, number>();

  incrementCounter(name: string, value: number = 1) {
    const current = this.counters.get(name) || { count: 0, lastUpdated: new Date() };
    this.counters.set(name, {
      count: current.count + value,
      lastUpdated: new Date(),
    });
  }

  recordTiming(name: string, duration: number) {
    const current = this.timings.get(name) || {
      total: 0,
      count: 0,
      min: Infinity,
      max: 0,
      avg: 0,
    };

    const newTotal = current.total + duration;
    const newCount = current.count + 1;

    this.timings.set(name, {
      total: newTotal,
      count: newCount,
      min: Math.min(current.min, duration),
      max: Math.max(current.max, duration),
      avg: newTotal / newCount,
    });
  }

  setGauge(name: string, value: number) {
    this.gauges.set(name, value);
  }

  getMetrics() {
    return {
      counters: Object.fromEntries(this.counters),
      timings: Object.fromEntries(this.timings),
      gauges: Object.fromEntries(this.gauges),
    };
  }

  reset() {
    this.counters.clear();
    this.timings.clear();
    this.gauges.clear();
  }
}

export const metrics = new MetricsCollector();

// Helper to time async operations
export async function timeAsync<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    metrics.recordTiming(name, Date.now() - start);
    return result;
  } catch (error) {
    metrics.recordTiming(name, Date.now() - start);
    throw error;
  }
}
