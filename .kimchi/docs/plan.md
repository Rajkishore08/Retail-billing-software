# Plan: Direct Image Upload for Logo and QR in Settings

## Goal
Replace URL-based logo input and UPI-based QR generation with direct image file uploads for both store logo and payment QR code. Uploaded images must display on the website and in generated bills (thermal print, PDF invoice, WhatsApp image share).

## Context from Exploration
- **Settings page** (`app/settings/page.tsx`): Currently has text inputs for "Logo URL" (`store_logo`) and "UPI ID" (`upi_id`). Settings saved to Supabase `settings` table with `key`/`value` columns.
- **Receipt preview** (`components/pos/receipt-preview.tsx`): Fetches settings from Supabase. Logo rendered as `<img src={storeSettings.store_logo}>`. QR generated dynamically via `api.qrserver.com` from `upi_id`.
- **Product images** use a working localStorage + base64 pattern (`lib/product-image-store.ts`). No Supabase Storage is configured.
- The `settings` table `value` column is TEXT. Storing large base64 strings in Supabase would bloat settings fetches and may hit size limits.

## Storage Decision
Use **localStorage + base64** (same pattern as product images) for the uploaded logo and QR images. This avoids Supabase storage setup, stays consistent with existing codebase patterns, and works offline. Receipt preview will read from localStorage first.

> **Note:** Images are device-local. For multi-device sync, a future migration to Supabase Storage can be done, but is out of scope.

## Files to Modify / Create

### 1. `lib/store-image-store.ts` (NEW)
Utility to persist store-level images (logo and QR) in localStorage, mirroring `product-image-store.ts`.

```typescript
const LOGO_KEY = "nmm_store_logo_image"
const QR_KEY = "nmm_store_qr_image"

export function getStoreLogo(): string | null
export function setStoreLogo(dataUrl: string): void
export function removeStoreLogo(): void
export function getStoreQrImage(): string | null
export function setStoreQrImage(dataUrl: string): void
export function removeStoreQrImage(): void
```

### 2. `app/settings/page.tsx` (MODIFY)
- Replace "Logo URL" text input with a file upload component for logo (keep URL as a secondary optional "URL Mode" tab or label for max compatibility — but user explicitly asked to replace URL with upload. Simplify: file upload main input, optional inline "Remove" button).
- Add "QR Code Image" file upload alongside the UPI ID field. Keep the UPI ID input — it is still useful for the UPI string on receipts. Add a clear label: "Upload QR code image (optional; replaces auto-generated QR)".
- On file select: `FileReader.readAsDataURL(file)` → `setStoreLogo(dataUrl)` or `setStoreQrImage(dataUrl)`.
- Update preview area to display both logo and QR from localStorage.
- On save: save text settings to Supabase as before. Images are already in localStorage.
- Add a "Remove image" button for each uploaded image.

### 3. `components/pos/receipt-preview.tsx` (MODIFY)
- Import logo from `getStoreLogo()` and QR image from `getStoreQrImage()`.
- In the live preview: use uploaded logo if available, else fall back to `storeSettings.store_logo`.
- In `generateThermalReceiptHTML()` and `generatePDFReceiptHTML()`: use uploaded logo/QR if available, else fall back to Supabase URL / UPI-generated QR.
- For the UPI QR preview section: if a custom QR image is uploaded, render that image instead of the `api.qrserver.com` generated one.

## UI/UX Details
- Settings card "Branding & Logo" will have:
  - Logo file upload with preview box (replace the existing preview box logic)
  - QR file upload with preview box (small square)
  - Keep UPI ID text field but label it: "UPI ID (shown below QR)"
- Accept only `image/*` files.
- Max reasonable file size check in client (e.g., 2MB warning).
- Use existing component styles (rounded-xl, border-dashed, etc.).

## Acceptance Criteria
1. Settings page shows file upload inputs for logo and QR.
2. Selecting an image shows a preview immediately.
3. Saving images stores them in localStorage.
4. Receipt preview uses uploaded logo (falls back to URL from Supabase if no upload).
5. Receipt preview uses uploaded QR image (falls back to UPI-generated QR if no upload).
6. Thermal print, PDF invoice, and WhatsApp image share all contain the correct logo and QR.
7. Removing an image clears it from localStorage.
8. No TypeScript or runtime errors.

## Implementation Order
1. Create `lib/store-image-store.ts`
2. Modify `app/settings/page.tsx`
3. Modify `components/pos/receipt-preview.tsx`
