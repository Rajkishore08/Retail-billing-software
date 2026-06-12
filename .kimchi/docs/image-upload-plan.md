# Plan: Direct Image Upload for Logo and QR Code

## Objective
Replace the URL-based logo input and UPI-based QR generation with direct image file uploads for both store logo and payment QR code. Uploaded images must display on the Settings page and in generated bills (thermal print, PDF invoice, WhatsApp image share).

## Storage Strategy
Use **localStorage + base64** (same pattern as product images in `lib/product-image-store.ts`). This avoids requiring Supabase Storage setup, stays consistent with existing codebase patterns, and works offline. Receipt preview will read from localStorage first, with fallbacks to Supabase settings (`store_logo` URL and UPI-generated QR).

> Note: Images are device-local, consistent with the existing product image behavior.

## Chunk Breakdown

### Chunk 1: Store Image Utility (`lib/store-image-store.ts`)
Create a new utility file mirroring `product-image-store.ts` but for store-level images.

API:
- `getStoreLogo(): string | null`
- `setStoreLogo(dataUrl: string): void`
- `removeStoreLogo(): void`
- `getStoreQrImage(): string | null`
- `setStoreQrImage(dataUrl: string): void`
- `removeStoreQrImage(): void`

### Chunk 2: Settings Page (`app/settings/page.tsx`)
Modify the "Branding & Logo" card:

1. **Logo Upload:**
   - Replace the "Logo URL" text input with a file upload input (`<input type="file" accept="image/*">`).
   - On file select: use `FileReader.readAsDataURL(file)` to get base64, then call `setStoreLogo(dataUrl)`.
   - Show the uploaded logo in the existing preview area (read from `getStoreLogo()` on mount).
   - Add a "Remove Logo" button that calls `removeStoreLogo()`.
   - Keep backward compatibility: if no localStorage logo exists, still display and allow editing the Supabase `store_logo` URL (but hide it or make it secondary — decision: simplify and REMOVE the URL input entirely. The user explicitly asked to replace links with uploads).

2. **QR Upload:**
   - Add a new file upload for "QR Code Image".
   - Preview it in a small box.
   - Keep the UPI ID text field (still useful for labeling the QR), but note in helper text: "Upload a custom QR image, or leave blank to auto-generate from UPI ID."
   - On file select: `FileReader.readAsDataURL(file)` → `setStoreQrImage(dataUrl)`.
   - Add "Remove QR Image" button.

3. **State management:**
   - Add `useEffect` to load images from localStorage on mount.
   - Since images are already persisted locally, the existing `updateSettings()` flow (which saves text fields to Supabase) does not need changes for image storage.

### Chunk 3: Receipt Preview (`components/pos/receipt-preview.tsx`)
Modify to use localStorage images with fallback:

1. Import the utility functions.
2. In the component body, read `const uploadedLogo = getStoreLogo(); const uploadedQr = getStoreQrImage();` before render.
3. **Logo usage:**
   - Live preview (`<img>`): use `uploadedLogo || storeSettings.store_logo`
   - Thermal print HTML: use `uploadedLogo || storeSettings.store_logo`
   - PDF invoice HTML: use `uploadedLogo || storeSettings.store_logo`
4. **QR usage:**
   - Live preview: if `uploadedQr` exists, show that image. Otherwise use `getUpiQrUrl()`.
   - Thermal print HTML: if `uploadedQr` exists, use it. Otherwise use `upiQrHtml`.
   - PDF invoice HTML: if `uploadedQr` exists, use it. Otherwise use `upiQrUrl`.
5. Ensure all `<img>` tags in generated HTML have `onerror="this.style.display='none'"`.

## Acceptance Criteria
1. Settings page allows file upload for logo and QR.
2. Image previews display immediately after selection.
3. Images persist in localStorage and survive page refreshes.
4. Receipt preview (live, thermal, PDF, WhatsApp image) uses uploaded images.
5. Fallback to old behavior works when no images are uploaded.
6. No TypeScript or runtime errors.
