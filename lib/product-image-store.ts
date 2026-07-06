// Utility to persist product images in localStorage
// Images are stored as URLs (external) or base64 data-URLs (uploads)

const KEY = "nmm_product_images_v1"

// In-memory cache to prevent constant reading and parsing from localStorage
let cachedImages: Record<string, string> | null = null

export function getAllProductImages(): Record<string, string> {
  if (cachedImages !== null) {
    return cachedImages
  }
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(KEY)
    cachedImages = raw ? JSON.parse(raw) : {}
    return cachedImages || {}
  } catch {
    return {}
  }
}

export function getProductImage(productId: string): string | null {
  return getAllProductImages()[productId] ?? null
}

export function setProductImage(productId: string, imageUrl: string): void {
  if (typeof window === "undefined") return
  try {
    const map = getAllProductImages()
    map[productId] = imageUrl
    cachedImages = map
    localStorage.setItem(KEY, JSON.stringify(map))
  } catch (e) {
    console.error("product-image-store: save failed", e)
  }
}

export function removeProductImage(productId: string): void {
  if (typeof window === "undefined") return
  try {
    const map = getAllProductImages()
    delete map[productId]
    cachedImages = map
    localStorage.setItem(KEY, JSON.stringify(map))
  } catch (e) {
    console.error("product-image-store: remove failed", e)
  }
}

/** 
 * Generate a deterministic gradient class for a product with no image.
 * Based on the first character of the product name.
 */
export function placeholderClass(name: string): string {
  const classes = [
    "img-placeholder-blue",
    "img-placeholder-emerald",
    "img-placeholder-amber",
    "img-placeholder-sky",
    "img-placeholder-rose",
    "img-placeholder-cyan",
    "img-placeholder-indigo",
  ]
  const idx = (name.charCodeAt(0) || 0) % classes.length
  return classes[idx]
}

/** Two-letter initials for a product name */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}
