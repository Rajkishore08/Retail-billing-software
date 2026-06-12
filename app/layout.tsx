import type { Metadata, Viewport } from "next"
import { Outfit, Space_Grotesk, Plus_Jakarta_Sans, Lexend } from "next/font/google"
import "./globals.css"
import { AppContent } from "@/components/app-content"
import { Toaster } from "@/components/ui/sonner"

/* ── Google Fonts via next/font ──────────────────────────────────────────── */
const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300","400","500","600","700","800","900"],
  variable: "--font-outfit",
  display: "swap",
})
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400","500","600","700"],
  variable: "--font-space-grotesk",
  display: "swap",
})
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300","400","500","600","700","800"],
  variable: "--font-plus-jakarta",
  display: "swap",
})
const lexend = Lexend({
  subsets: ["latin"],
  weight: ["300","400","500","600","700"],
  variable: "--font-lexend",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Techno Bills - POS System",
  description: "Point of Sale system for Techno Bills — GST billing, inventory & analytics.",
  keywords: ["POS", "retail", "billing", "inventory", "GST"],
  authors: [{ name: "Techno Bills" }],
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/placeholder-logo.png",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${outfit.variable} ${spaceGrotesk.variable} ${plusJakartaSans.variable} ${lexend.variable}`}
    >
      <body suppressHydrationWarning>
        <AppContent>{children}</AppContent>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
