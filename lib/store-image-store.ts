// Utility to persist store-level images in localStorage
// Images are stored as base64 data-URLs (logo and QR code)

const LOGO_KEY = "nmm_store_logo_image"
const QR_KEY = "nmm_store_qr_image"

export function getStoreLogo(): string | null {
  if (typeof window === "undefined") return null
  try {
    return localStorage.getItem(LOGO_KEY)
  } catch (e) {
    console.error("store-image-store: getStoreLogo failed", e)
    return null
  }
}

export function setStoreLogo(dataUrl: string): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(LOGO_KEY, dataUrl)
  } catch (e) {
    console.error("store-image-store: setStoreLogo failed", e)
  }
}

export function removeStoreLogo(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(LOGO_KEY)
  } catch (e) {
    console.error("store-image-store: removeStoreLogo failed", e)
  }
}

export function getStoreQrImage(): string | null {
  if (typeof window === "undefined") return null
  try {
    return localStorage.getItem(QR_KEY)
  } catch (e) {
    console.error("store-image-store: getStoreQrImage failed", e)
    return null
  }
}

export function setStoreQrImage(dataUrl: string): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(QR_KEY, dataUrl)
  } catch (e) {
    console.error("store-image-store: setStoreQrImage failed", e)
  }
}

export function removeStoreQrImage(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(QR_KEY)
  } catch (e) {
    console.error("store-image-store: removeStoreQrImage failed", e)
  }
}