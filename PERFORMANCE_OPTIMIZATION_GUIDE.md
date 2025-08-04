# Performance Optimization Guide for National Mini Mart POS

## 🚨 **Common Performance Issues**

### **1. Database Query Performance**
- **RPC calls** taking 2-5 seconds
- **Large data sets** without pagination
- **Missing database indexes**
- **Network latency** to Supabase

### **2. Browser Performance**
- **React DevTools** extension slowing down app
- **Browser cache conflicts**
- **Large bundle sizes**
- **Memory leaks** from component re-renders

### **3. Asset Loading**
- **Unoptimized images**
- **Large CSS/JS files**
- **No lazy loading** for components

## ✅ **Immediate Fixes**

### **1. Database Optimization**
```sql
-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

-- Optimize RPC functions
CREATE OR REPLACE FUNCTION get_dashboard_stats_optimized()
RETURNS TABLE (
  total_products bigint,
  total_customers bigint,
  monthly_revenue numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM products WHERE active = true),
    (SELECT COUNT(*) FROM customers),
    COALESCE(SUM(total_amount), 0)
  FROM transactions 
  WHERE created_at >= date_trunc('month', CURRENT_DATE);
END;
$$ LANGUAGE plpgsql;
```

### **2. Component Lazy Loading**
```typescript
// In app/dashboard/page.tsx
import dynamic from 'next/dynamic'

const SalesCharts = dynamic(() => import('@/components/dashboard/sales-charts'), {
  loading: () => <div>Loading charts...</div>,
  ssr: false
})

const POSInterface = dynamic(() => import('@/components/pos/pos-interface'), {
  loading: () => <div>Loading POS...</div>
})
```

### **3. Image Optimization**
```typescript
// Use Next.js Image component
import Image from 'next/image'

<Image
  src="/placeholder-logo.png"
  alt="Logo"
  width={100}
  height={100}
  priority={false}
  placeholder="blur"
/>
```

### **4. Bundle Size Reduction**
```javascript
// next.config.js
module.exports = {
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['@/components/ui']
  },
  webpack: (config) => {
    config.optimization.splitChunks = {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
      },
    }
    return config
  },
}
```

## 🔧 **Advanced Optimizations**

### **1. Database Connection Pooling**
```typescript
// lib/supabase-client.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'Cache-Control': 'no-cache'
    }
  }
})
```

### **2. React Query for Caching**
```typescript
// hooks/use-sales-data.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase-client'

export function useSalesData(timeRange: string) {
  return useQuery({
    queryKey: ['sales-data', timeRange],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_sales_analytics', {
        start_date: new Date(Date.now() - parseInt(timeRange) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0]
      })
      if (error) throw error
      return data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  })
}
```

### **3. Virtual Scrolling for Large Lists**
```typescript
// components/products/product-list.tsx
import { FixedSizeList as List } from 'react-window'

const ProductList = ({ products }) => {
  const Row = ({ index, style }) => (
    <div style={style}>
      <ProductCard product={products[index]} />
    </div>
  )

  return (
    <List
      height={600}
      itemCount={products.length}
      itemSize={100}
      width="100%"
    >
      {Row}
    </List>
  )
}
```

## 📊 **Performance Monitoring**

### **1. Bundle Analyzer**
```bash
# Install bundle analyzer
npm install --save-dev @next/bundle-analyzer

# Add to next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

# Run analysis
ANALYZE=true npm run build
```

### **2. Performance Metrics**
```typescript
// utils/performance.ts
export const measurePerformance = (name: string) => {
  const start = performance.now()
  return () => {
    const end = performance.now()
    console.log(`${name} took ${end - start}ms`)
  }
}

// Usage in components
const endMeasure = measurePerformance('SalesCharts render')
useEffect(() => {
  endMeasure()
}, [salesData])
```

### **3. Database Query Monitoring**
```sql
-- Check slow queries
SELECT 
  query,
  mean_time,
  calls,
  total_time
FROM pg_stat_statements 
WHERE mean_time > 1000
ORDER BY mean_time DESC;
```

## 🚀 **User Instructions**

### **For Staff:**
1. **Hard refresh** (Ctrl + F5) if app seems slow
2. **Clear browser cache** monthly
3. **Disable extensions** if experiencing issues
4. **Use incognito mode** for testing

### **For IT Admin:**
1. **Monitor database performance** weekly
2. **Check bundle sizes** after updates
3. **Review error logs** for performance issues
4. **Update dependencies** regularly

## 🎯 **Expected Results**

After implementing these optimizations:
- ✅ **50-70% faster** initial page loads
- ✅ **Smoother** POS interface interactions
- ✅ **Reduced** database query times
- ✅ **Better** user experience for staff
- ✅ **Lower** memory usage
- ✅ **Faster** chart rendering

## 🔍 **Troubleshooting**

### **If Still Slow:**
1. **Check network tab** in DevTools for failed requests
2. **Monitor database** query performance
3. **Disable all extensions** and test
4. **Try different browser** to isolate issue
5. **Check server logs** for errors

### **Common Issues:**
- **Large product images** → Optimize images
- **Too many database calls** → Implement caching
- **Memory leaks** → Check component cleanup
- **Bundle too large** → Implement code splitting

The most impactful fixes are usually:
1. **Database query optimization**
2. **Component lazy loading**
3. **Browser cache clearing**
4. **Disabling React DevTools extension** 