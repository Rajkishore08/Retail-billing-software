# Codebase Exploration Summary

## 1. Settings Page Location

**File:** `/mnt/c/Users/Kavidhrashan S/OneDrive/Desktop/Retail-billing-software-main/app/settings/page.tsx`

The settings page manages three categories:
- **User Profile** — full name, email (read-only), role (admin/manager/cashier)
- **Branding & Logo** — store logo URL, UPI ID
- **Store Information** — store name, address, phone, GST number, default GST rate, receipt footer
- **System Settings** — printer width, currency format, date format (UI only, not persisted)

---

## 2. Logo and QR Code — Current Implementation

### Logo Storage
- **In settings UI:** Text input field labeled "Logo URL" accepts a direct image URL (PNG, JPG, SVG)
- **Stored in database:** `settings` table, `key = 'store_logo'`, `value = <URL string>`
- **Also cached in localStorage** as `localStorage.setItem("store_logo", url)`
- **Preview:** Rendered via `<img src={storeSettings.store_logo} />` with error fallback

### UPI/QR Code
- **UPI ID input** in settings: Text field labeled "UPI ID for Receipts"
- **Stored in database:** `settings` table, `key = 'upi_id'`, `value = <UPI ID string>`
- **QR code generation:** Done on-the-fly in `receipt-preview.tsx` using:
  ```
  https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=<UPI string>
  ```
- **UPI string format:** `upi://pay?pa=${upiId}&pn=${storeName}&am=${amount}&cu=INR`

### Key Finding: NO file upload for logo
The settings page has only a URL text input — no file picker, no file upload mechanism. Users must host their logo image externally and paste the URL.

---

## 3. Bill Generation Components

### Receipt Preview Component
**File:** `/mnt/c/Users/Kavidhrashan S/OneDrive/Desktop/Retail-billing-software-main/components/pos/receipt-preview.tsx`

This component:
1. Fetches store settings from `settings` table on mount
2. Renders a live receipt preview (used for display and screenshot capture)
3. Generates three output formats:
   - **Thermal Print** — Opens a new window with monospace HTML, triggers browser print
   - **PDF Invoice** — Opens a new window with styled HTML, triggers browser print
   - **WhatsApp Image** — Uses `html2canvas` to capture the preview div as PNG, shares via Web Share API or downloads
   - **WhatsApp Text** — Plain text bill summary shared via `wa.me` link

### How Logo is Used in Bills

**In thermal receipt HTML:**
```html
const logoHtml = storeSettings.store_logo
  ? `<img src="${storeSettings.store_logo}" alt="Logo" style="height:60px;object-fit:contain;margin-bottom:6px;" onerror="this.style.display='none'" /><br/>`
  : ""
```

**In PDF invoice HTML:**
```html
${storeSettings.store_logo ? `<img src="${storeSettings.store_logo}" class="logo" alt="Logo" onerror="this.style.display='none'" /><br/>` : ""}
```

**In live preview:**
```tsx
{storeSettings.store_logo && (
  <img src={storeSettings.store_logo} alt="Logo" className="h-12 mx-auto object-contain mb-1"
    onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
  />
)}
```

### How QR Code is Used in Bills

```tsx
const upiQrUrl = getUpiQrUrl()
// ...
const getUpiQrUrl = () => {
  const upiId = storeSettings.upi_id
  if (!upiId) return null
  const storeName = storeSettings.store_name || "Store"
  const amount = transaction.total_amount.toFixed(2)
  const upiString = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(storeName)}&am=${amount}&cu=INR&tn=Bill%20${transaction.invoice_number}`
  return `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(upiString)}`
}
```

QR code is rendered inline in the receipt preview and included in the print/PDF HTML.

---

## 4. Database Schema — Settings Table

### From `scripts/01-database-setup.sql`:
```sql
CREATE TABLE settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

RLS enabled with policy: `auth.role() = 'authenticated'` (full access to authenticated users)

### Settings stored in the `settings` table:
| Key | Description |
|-----|-------------|
| `store_name` | Store display name |
| `store_address` | Physical address |
| `store_phone` | Contact number |
| `gst_number` | GSTIN number |
| `default_gst_rate` | Default GST percentage |
| `receipt_footer` | Footer message on receipts |
| `store_logo` | **Logo image URL** |
| `upi_id` | UPI payment ID |
| `enable_discounts` | Whether discounts are enabled |
| `default_discount_percentage` | Default discount % |
| `show_savings_on_receipt` | Show savings on receipt |
| `enable_mrp_display` | Show MRP on receipt |

---

## 5. Supabase Storage — Status

**Finding: No Supabase storage buckets are configured or used.**

- No `storage` keyword matches found in the codebase
- No `bucket` references found
- The `supabase-client.ts` does not include any storage client initialization
- Product images use a **localStorage + base64** pattern instead (see below)

---

## 6. File Upload Pattern — Product Images (Reference Implementation)

**File:** `/mnt/c/Users/Kavidhrashan S/OneDrive/Desktop/Retail-billing-software-main/app/products/page.tsx`
**Utility:** `/mnt/c/Users/Kavidhrashan S/OneDrive/Desktop/Retail-billing-software-main/lib/product-image-store.ts`

The products page has a working image upload pattern:

1. **File input** via `<input type="file" ref={fileRef} accept="image/*" onChange={handleImageFile} />`
2. **File read** using `FileReader.readAsDataURL(file)` — converts image to base64 data URL
3. **Storage** — base64 string stored in `localStorage` under key `nmm_product_images_v1`
4. **Retrieval** — `getAllProductImages()` reads from localStorage and returns `Record<productId, imageUrl>`

```ts
// From product-image-store.ts
export function setProductImage(productId: string, imageUrl: string): void {
  if (typeof window === "undefined") return
  const map = getAllProductImages()
  map[productId] = imageUrl
  localStorage.setItem(KEY, JSON.stringify(map))
}
```

**Limitation:** This approach is client-side only (localStorage). Images are not persisted server-side.

### Image modes in Products page:
- **URL mode:** Paste a direct image URL
- **Upload mode:** Click to select file → base64 → localStorage

The same dual-mode pattern could be applied to the settings logo upload, replacing the URL-only approach currently in place.

---

## 7. Placeholder Assets

**Location:** `/mnt/c/Users/Kavidhrashan S/OneDrive/Desktop/Retail-billing-software-main/public/`
- `placeholder-logo.png` — placeholder logo image
- `placeholder-logo.svg` — placeholder logo SVG

---

## Summary of Key Findings

| Aspect | Current State |
|--------|--------------|
| Logo input | URL text only, no file upload |
| Logo storage | URL string in `settings` table |
| Logo on bills | Fetched from `settings`, rendered as `<img>` |
| QR code | Generated on-the-fly via api.qrserver.com |
| QR storage | Not stored; generated from `upi_id` at bill time |
| UPI ID storage | Plain text in `settings` table |
| Supabase storage | Not configured |
| File upload pattern | localStorage + base64 (only for product images) |
| Product image upload | Works (localStorage, base64) |

---

## Relevant File Paths

- Settings page: `app/settings/page.tsx`
- Receipt/bill generation: `components/pos/receipt-preview.tsx`
- Product image store: `lib/product-image-store.ts`
- Product page (image upload reference): `app/products/page.tsx`
- Supabase client: `lib/supabase-client.ts`
- Database setup: `scripts/01-database-setup.sql`
- Complete schema: `scripts/setup-complete-database.sql`
- Placeholder logos: `public/placeholder-logo.png`, `public/placeholder-logo.svg`