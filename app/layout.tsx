import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { AppContent } from "@/components/app-content"
import { Toaster } from "@/components/ui/sonner"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "National Mini Mart - POS System",
  description: "Point of Sale system for National Mini Mart",
  keywords: ["POS", "retail", "billing", "inventory"],
  authors: [{ name: "National Mini Mart" }],
  // Cache control headers
  other: {
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0"
  }
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Cache busting meta tags */}
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        {/* Version-based cache clearing */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const currentVersion = '1.0.0';
                const storedVersion = localStorage.getItem('app_version');
                
                if (storedVersion !== currentVersion) {
                  // Clear all caches
                  if ('caches' in window) {
                    caches.keys().then(names => {
                      names.forEach(name => caches.delete(name));
                    });
                  }
                  
                  // Clear storage
                  localStorage.clear();
                  sessionStorage.clear();
                  
                  // Store new version
                  localStorage.setItem('app_version', currentVersion);
                  
                  // Force reload if version changed
                  if (storedVersion) {
                    window.location.reload(true);
                  }
                }
              })();
            `
          }}
        />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <AppContent>
          {children}
        </AppContent>
        <Toaster />
      </body>
    </html>
  )
}
