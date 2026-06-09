// Performance monitoring utilities

export class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private metrics: Map<string, number[]> = new Map()

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  startTimer(operation: string): () => void {
    const startTime = performance.now()
    
    return () => {
      const endTime = performance.now()
      const duration = endTime - startTime
      
      if (!this.metrics.has(operation)) {
        this.metrics.set(operation, [])
      }
      
      this.metrics.get(operation)!.push(duration)
      
      // Log slow operations
      if (duration > 1000) {
        console.warn(`Slow operation detected: ${operation} took ${duration.toFixed(2)}ms`)
      }
    }
  }

  getAverageTime(operation: string): number {
    const times = this.metrics.get(operation)
    if (!times || times.length === 0) return 0
    
    const sum = times.reduce((acc, time) => acc + time, 0)
    return sum / times.length
  }

  getMetrics(): Record<string, { average: number; count: number }> {
    const result: Record<string, { average: number; count: number }> = {}
    
    for (const [operation, times] of this.metrics.entries()) {
      result[operation] = {
        average: this.getAverageTime(operation),
        count: times.length
      }
    }
    
    return result
  }

  clearMetrics(): void {
    this.metrics.clear()
  }
}

// Utility function to measure async operations
export async function measureAsync<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const monitor = PerformanceMonitor.getInstance()
  const endTimer = monitor.startTimer(operation)
  
  try {
    const result = await fn()
    return result
  } finally {
    endTimer()
  }
}

// Utility function to measure sync operations
export function measureSync<T>(
  operation: string,
  fn: () => T
): T {
  const monitor = PerformanceMonitor.getInstance()
  const endTimer = monitor.startTimer(operation)
  
  try {
    const result = fn()
    return result
  } finally {
    endTimer()
  }
}

// Hook for React components
export function usePerformanceMonitor() {
  return {
    measureAsync,
    measureSync,
    getMetrics: () => PerformanceMonitor.getInstance().getMetrics(),
    clearMetrics: () => PerformanceMonitor.getInstance().clearMetrics(),
  }
} 