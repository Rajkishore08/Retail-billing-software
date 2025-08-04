"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, Zap, AlertTriangle, CheckCircle } from "lucide-react"

interface PerformanceMetrics {
  pageLoadTime: number
  apiResponseTime: number
  databaseQueryTime: number
  bundleSize: number
  memoryUsage: number
}

export function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    pageLoadTime: 0,
    apiResponseTime: 0,
    databaseQueryTime: 0,
    bundleSize: 0,
    memoryUsage: 0,
  })

  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Only show in development
    if (process.env.NODE_ENV === 'development') {
      setIsVisible(true)
    }

    // Measure page load time
    const pageLoadStart = performance.now()
    
    window.addEventListener('load', () => {
      const pageLoadTime = performance.now() - pageLoadStart
      setMetrics(prev => ({ ...prev, pageLoadTime }))
    })

    // Measure memory usage
    if ('memory' in performance) {
      const memory = (performance as any).memory
      setMetrics(prev => ({ 
        ...prev, 
        memoryUsage: memory.usedJSHeapSize / 1024 / 1024 // Convert to MB
      }))
    }

    // Monitor API calls
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      const start = performance.now()
      try {
        const response = await originalFetch(...args)
        const end = performance.now()
        setMetrics(prev => ({ 
          ...prev, 
          apiResponseTime: end - start 
        }))
        return response
      } catch (error) {
        const end = performance.now()
        setMetrics(prev => ({ 
          ...prev, 
          apiResponseTime: end - start 
        }))
        throw error
      }
    }

    // Cleanup
    return () => {
      window.fetch = originalFetch
    }
  }, [])

  const getPerformanceStatus = () => {
    if (metrics.pageLoadTime < 2000) return 'good'
    if (metrics.pageLoadTime < 5000) return 'warning'
    return 'poor'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'bg-green-100 text-green-800'
      case 'warning': return 'bg-yellow-100 text-yellow-800'
      case 'poor': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good': return <CheckCircle className="h-4 w-4" />
      case 'warning': return <AlertTriangle className="h-4 w-4" />
      case 'poor': return <AlertTriangle className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  if (!isVisible) return null

  return (
    <Card className="fixed bottom-4 right-4 w-80 z-50 bg-white/95 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Performance Monitor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs">Page Load:</span>
          <Badge className={`text-xs ${getPerformanceStatus() === 'good' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {metrics.pageLoadTime.toFixed(0)}ms
          </Badge>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-xs">API Response:</span>
          <Badge className="text-xs bg-blue-100 text-blue-800">
            {metrics.apiResponseTime.toFixed(0)}ms
          </Badge>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-xs">Memory Usage:</span>
          <Badge className="text-xs bg-purple-100 text-purple-800">
            {metrics.memoryUsage.toFixed(1)}MB
          </Badge>
        </div>

        <div className="flex justify-between items-center pt-1 border-t">
          <span className="text-xs font-medium">Status:</span>
          <Badge className={`text-xs ${getStatusColor(getPerformanceStatus())}`}>
            {getStatusIcon(getPerformanceStatus())}
            <span className="ml-1 capitalize">{getPerformanceStatus()}</span>
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
} 