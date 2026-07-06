// Utility to persist store-level images in localStorage
// Images are stored as base64 data-URLs (logo and QR code)

const LOGO_KEY = "nmm_store_logo_image"
const QR_KEY = "nmm_store_qr_image"

// In-memory cache variables
let cachedLogo: string | null = null
let cachedQr: string | null = null

export function getStoreLogo(): string | null {
  if (cachedLogo !== null) return cachedLogo
  if (typeof window === "undefined") return null
  try {
    cachedLogo = localStorage.getItem(LOGO_KEY)
    return cachedLogo
  } catch (e) {
    console.error("store-image-store: getStoreLogo failed", e)
    return null
  }
}

export function setStoreLogo(dataUrl: string): void {
  if (typeof window === "undefined") return
  try {
    cachedLogo = dataUrl
    localStorage.setItem(LOGO_KEY, dataUrl)
  } catch (e) {
    console.error("store-image-store: setStoreLogo failed", e)
  }
}

export function removeStoreLogo(): void {
  if (typeof window === "undefined") return
  try {
    cachedLogo = null
    localStorage.removeItem(LOGO_KEY)
  } catch (e) {
    console.error("store-image-store: removeStoreLogo failed", e)
  }
}

export function getStoreQrImage(): string | null {
  if (cachedQr !== null) return cachedQr
  if (typeof window === "undefined") return null
  try {
    cachedQr = localStorage.getItem(QR_KEY)
    return cachedQr
  } catch (e) {
    console.error("store-image-store: getStoreQrImage failed", e)
    return null
  }
}

export function setStoreQrImage(dataUrl: string): void {
  if (typeof window === "undefined") return
  try {
    cachedQr = dataUrl
    localStorage.setItem(QR_KEY, dataUrl)
  } catch (e) {
    console.error("store-image-store: setStoreQrImage failed", e)
  }
}

export function removeStoreQrImage(): void {
  if (typeof window === "undefined") return
  try {
    cachedQr = null
    localStorage.removeItem(QR_KEY)
  } catch (e) {
    console.error("store-image-store: removeStoreQrImage failed", e)
  }
}