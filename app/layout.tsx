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
        {/* Smart cache management */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const currentVersion = '1.0.1';
                const storedVersion = localStorage.getItem('app_version');
                
                // Only clear cache on version change, not every load
                if (storedVersion && storedVersion !== currentVersion) {
                  // Clear caches only when version changes
                  if ('caches' in window) {
                    caches.keys().then(names => {
                      names.forEach(name => caches.delete(name));
                    });
                  }
                  
                  // Store new version
                  localStorage.setItem('app_version', currentVersion);
                  
                  // Force reload only on version change
                  window.location.reload(true);
                } else if (!storedVersion) {
                  // First time visit - just store version
                  localStorage.setItem('app_version', currentVersion);
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
