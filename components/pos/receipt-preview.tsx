"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase-client"
import { Printer, Gift, FileText, MessageCircle, X, ImageDown, Loader2 } from "lucide-react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { getStoreLogo, getStoreQrImage } from "@/lib/store-image-store"

type ReceiptProps = {
  transaction: any
  onClose: () => void
}

export function ReceiptPreview({ transaction, onClose }: ReceiptProps) {
  const [storeSettings, setStoreSettings] = useState<Record<string, string>>({})
  const [capturingImage, setCapturingImage] = useState(false)
  const receiptRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchStoreSettings()
  }, [])

  const fetchStoreSettings = async () => {
    const { data } = await supabase.from("settings").select("key, value")
    if (data) {
      const settings = data.reduce((acc, s) => { acc[s.key] = s.value; return acc }, {} as Record<string, string>)
      setStoreSettings(settings)
    }
  }

  const uploadedLogo = getStoreLogo()
  const uploadedQr = getStoreQrImage()
  const effectiveLogo = uploadedLogo || storeSettings.store_logo || ""
  const effectiveQr = uploadedQr || null

  const calculateTotalSavings = () => {
    let totalSavings = 0
    totalSavings += transaction.discount_amount || 0
    totalSavings += transaction.loyalty_discount_amount || 0
    if (transaction.items) {
      transaction.items.forEach((item: any) => {
        if (item.product.mrp && item.product.selling_price) {
          totalSavings += (item.product.mrp - item.product.selling_price) * item.quantity
        }
      })
    }
    return totalSavings
  }

  // ── Share as IMAGE on WhatsApp ──────────────────────────────────
  const shareAsWhatsAppImage = async () => {
    if (!receiptRef.current) return
    setCapturingImage(true)
    try {
      const html2canvas = (await import("html2canvas")).default
      const canvas = await html2canvas(receiptRef.current, {
        backgroundColor: "#ffffff",
        scale: 2.5,          // high-DPI for crisp text
        useCORS: true,
        logging: false,
      })

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => b ? resolve(b) : reject(new Error("Canvas is empty")), "image/png")
      })

      const file = new File([blob], `Bill-${transaction.invoice_number}.png`, { type: "image/png" })

      // Use Web Share API (works on Android / iOS browsers)
      if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Bill ${transaction.invoice_number}` })
        toast.success("Receipt shared!")
      } else {
        // Fallback: download so user can attach manually in WhatsApp Web
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `Bill-${transaction.invoice_number}.png`
        a.click()
        URL.revokeObjectURL(url)
        toast.info("Image saved! Open WhatsApp Web → attach this image to share your bill.", { duration: 5000 })
      }
    } catch (err: any) {
      console.error(err)
      toast.error("Could not capture receipt image.")
    } finally {
      setCapturingImage(false)
    }
  }

  // ── WhatsApp Text Share (fallback) ──────────────────────────────
  const shareTextOnWhatsApp = () => {
    const storeName = storeSettings.store_name || "Techno Bills"
    const date = new Date(transaction.created_at).toLocaleDateString("en-IN")
    const time = new Date(transaction.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    const itemLines = transaction.items
      .map((item: any) => `  • ${item.product.name} x${item.quantity} = ₹${((item.product.selling_price || item.product.price) * item.quantity).toFixed(2)}`)
      .join("\n")
    const savings = calculateTotalSavings()
    let msg = `🧾 *${storeName}*\nBill No: *${transaction.invoice_number}*\nDate: ${date} | Time: ${time}\n`
    if (transaction.customer) msg += `Customer: ${transaction.customer.name}\n`
    msg += `\n*Items:*\n${itemLines}\n\n---------------------------\n`
    msg += `Subtotal: ₹${transaction.subtotal.toFixed(2)}\nGST: ₹${transaction.gst_amount.toFixed(2)}\n`
    if (transaction.discount_amount > 0) msg += `Discount: -₹${transaction.discount_amount.toFixed(2)}\n`
    if (savings > 0) msg += `You Saved: ₹${savings.toFixed(2)} 🎉\n`
    msg += `*TOTAL: ₹${transaction.total_amount.toFixed(2)}*\nPayment: ${transaction.payment_method.toUpperCase()}\n`
    if (transaction.loyalty_points_earned > 0) msg += `\n⭐ Loyalty Points: +${transaction.loyalty_points_earned}\n`
    msg += `\nThank you! 🙏`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank")
  }

  // ── UPI QR Code URL ─────────────────────────────────────────────
  const getUpiQrUrl = () => {
    const upiId = storeSettings.upi_id
    if (!upiId) return null
    const storeName = storeSettings.store_name || "Store"
    const amount = transaction.total_amount.toFixed(2)
    const upiString = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(storeName)}&am=${amount}&cu=INR&tn=Bill%20${transaction.invoice_number}`
    return `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(upiString)}`
  }

  // ── Thermal Print HTML ──────────────────────────────────────────
  const printThermalReceipt = () => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) return
    printWindow.document.write(generateThermalReceiptHTML())
    printWindow.document.close()
    setTimeout(() => printWindow.print(), 400)
  }

  const generatePDFReceipt = () => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) return
    printWindow.document.write(generatePDFReceiptHTML())
    printWindow.document.close()
    setTimeout(() => printWindow.print(), 400)
  }

  const logoHtml = effectiveLogo
    ? `<img src="${effectiveLogo}" alt="Logo" style="height:60px;object-fit:contain;margin-bottom:6px;" onerror="this.style.display='none'" /><br/>`
    : ""

  const upiQrUrl = getUpiQrUrl()
  const upiQrHtml = effectiveQr
    ? `<div style="text-align:center;margin:10px 0;">
        <div style="font-size:11px;font-weight:bold;margin-bottom:4px;">Scan to Pay via UPI</div>
        <img src="${effectiveQr}" alt="UPI QR" style="width:100px;height:100px;" />
        <div style="font-size:10px;color:#666;margin-top:2px;">${storeSettings.upi_id}</div>
       </div>`
    : upiQrUrl
    ? `<div style="text-align:center;margin:10px 0;">
        <div style="font-size:11px;font-weight:bold;margin-bottom:4px;">Scan to Pay via UPI</div>
        <img src="${upiQrUrl}" alt="UPI QR" style="width:100px;height:100px;" />
        <div style="font-size:10px;color:#666;margin-top:2px;">${storeSettings.upi_id}</div>
       </div>`
    : ""

  const generateThermalReceiptHTML = () => {
    const savings = calculateTotalSavings()
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt</title>
      <style>
        body{font-family:monospace;font-size:12px;margin:0;padding:10px;max-width:300px;}
        .center{text-align:center;}.bold{font-weight:bold;}
        .row{display:flex;justify-content:space-between;margin:2px 0;}
        .line{border-top:1px dashed #000;margin:6px 0;}
        .total{font-weight:bold;font-size:14px;}
        .loyalty-box{border:1px solid #000;padding:5px;margin:8px 0;text-align:center;}
        @media print{@page{margin:0;size:80mm auto;}}
      </style></head><body>
      <div class="center">
        ${logoHtml}
        <div class="bold" style="font-size:15px;">${storeSettings.store_name || "TECHNO BILLS"}</div>
        ${storeSettings.store_address ? `<div style="font-size:10px;">${storeSettings.store_address}</div>` : ""}
        ${storeSettings.store_phone ? `<div style="font-size:10px;">Ph: ${storeSettings.store_phone}</div>` : ""}
        ${storeSettings.gst_number ? `<div style="font-size:10px;">GSTIN: ${storeSettings.gst_number}</div>` : ""}
      </div>
      <div class="line"></div>
      <div class="row"><span>Bill No:</span><span>${transaction.invoice_number}</span></div>
      <div class="row"><span>Date:</span><span>${new Date(transaction.created_at).toLocaleDateString("en-IN")}</span></div>
      <div class="row"><span>Time:</span><span>${new Date(transaction.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span></div>
      ${transaction.customer ? `<div class="row"><span>Customer:</span><span>${transaction.customer.name}</span></div>` : ""}
      <div class="line"></div>
      <div class="row bold"><span style="width:45%">Item</span><span style="width:15%;text-align:center">Qty</span><span style="width:20%;text-align:center">Rate</span><span style="width:20%;text-align:right">Amt</span></div>
      <div class="line"></div>
      ${transaction.items.map((item: any) => {
        const price = item.product.selling_price || item.product.price
        return `<div class="row"><span style="width:45%;font-size:10px;">${item.product.name}</span><span style="width:15%;text-align:center">${item.quantity}</span><span style="width:20%;text-align:center">₹${price}</span><span style="width:20%;text-align:right">₹${(price * item.quantity).toFixed(2)}</span></div>`
      }).join("")}
      <div class="line"></div>
      <div class="row"><span>Subtotal:</span><span>₹${transaction.subtotal.toFixed(2)}</span></div>
      <div class="row"><span>GST:</span><span>₹${transaction.gst_amount.toFixed(2)}</span></div>
      ${transaction.discount_amount > 0 ? `<div class="row"><span>Discount:</span><span>-₹${transaction.discount_amount.toFixed(2)}</span></div>` : ""}
      ${transaction.loyalty_discount_amount > 0 ? `<div class="row"><span>Loyalty Discount:</span><span>-₹${transaction.loyalty_discount_amount.toFixed(2)}</span></div>` : ""}
      ${savings > 0 ? `<div class="row" style="color:green;"><span>You Saved:</span><span>₹${savings.toFixed(2)}</span></div>` : ""}
      <div class="line"></div>
      <div class="row total"><span>TOTAL:</span><span>₹${transaction.total_amount.toFixed(2)}</span></div>
      <div class="line"></div>
      <div class="row"><span>Payment:</span><span>${transaction.payment_method.toUpperCase()}</span></div>
      ${transaction.cash_received ? `<div class="row"><span>Cash:</span><span>₹${transaction.cash_received.toFixed(2)}</span></div><div class="row"><span>Change:</span><span>₹${(transaction.change_amount || 0).toFixed(2)}</span></div>` : ""}
      ${upiQrHtml}
      ${transaction.customer && transaction.loyalty_points_earned > 0 ? `<div class="loyalty-box"><div class="bold">⭐ LOYALTY POINTS</div><div>Earned: +${transaction.loyalty_points_earned}</div></div>` : ""}
      <div class="line"></div>
      <div class="center" style="font-size:11px;">${storeSettings.receipt_footer || "Thank You! Visit Again!"}</div>
    </body></html>`
  }

  const generatePDFReceiptHTML = () => {
    const savings = calculateTotalSavings()
    const pdfLogoHtml = effectiveLogo ? `<img src="${effectiveLogo}" class="logo" alt="Logo" onerror="this.style.display='none'" /><br/>` : ""
    const pdfQrHtml = effectiveQr
      ? `<div class="qr-section"><div style="font-size:13px;font-weight:bold;margin-bottom:8px;">💳 Pay via UPI / Scan QR</div><img src="${effectiveQr}" width="110" height="110" alt="UPI QR"/><div style="font-size:12px;color:#555;margin-top:4px;">${storeSettings.upi_id}</div></div>`
      : upiQrUrl
      ? `<div class="qr-section"><div style="font-size:13px;font-weight:bold;margin-bottom:8px;">💳 Pay via UPI / Scan QR</div><img src="${upiQrUrl}" width="110" height="110" alt="UPI QR"/><div style="font-size:12px;color:#555;margin-top:4px;">${storeSettings.upi_id}</div></div>`
      : ""
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice - ${transaction.invoice_number}</title>
      <style>
        body{font-family:Arial,sans-serif;margin:0;padding:24px;max-width:520px;color:#111;}
        .header{text-align:center;border-bottom:2px solid #222;padding-bottom:12px;margin-bottom:16px;}
        .logo{max-height:70px;object-fit:contain;margin-bottom:8px;}
        .title{font-size:22px;font-weight:bold;}
        .sub{font-size:13px;color:#555;margin:2px 0;}
        table{width:100%;border-collapse:collapse;margin:12px 0;}
        th{background:#f1f5f9;padding:8px;text-align:left;font-size:13px;border-bottom:2px solid #ccc;}
        td{padding:7px 8px;font-size:13px;border-bottom:1px solid #e2e8f0;}
        .total-row td{font-weight:bold;font-size:15px;border-top:2px solid #222;background:#f8fafc;}
        .savings{color:#16a34a;font-weight:bold;}
        .footer{text-align:center;margin-top:20px;padding-top:12px;border-top:1px solid #ddd;color:#555;font-size:12px;}
        .qr-section{text-align:center;margin:16px 0;padding:12px;border:1px dashed #ccc;border-radius:8px;}
        @media print{@page{margin:1cm;}}
      </style></head><body>
      <div class="header">
        ${pdfLogoHtml}
        <div class="title">${storeSettings.store_name || "TECHNO BILLS"}</div>
        ${storeSettings.store_address ? `<div class="sub">${storeSettings.store_address}</div>` : ""}
        ${storeSettings.store_phone ? `<div class="sub">Phone: ${storeSettings.store_phone}</div>` : ""}
        ${storeSettings.gst_number ? `<div class="sub">GSTIN: ${storeSettings.gst_number}</div>` : ""}
      </div>
      <table><tr><td><strong>Invoice No:</strong> ${transaction.invoice_number}</td><td style="text-align:right"><strong>Date:</strong> ${new Date(transaction.created_at).toLocaleDateString("en-IN")}</td></tr>
      <tr><td><strong>Cashier:</strong> ${transaction.cashier?.full_name || "Staff"}</td><td style="text-align:right"><strong>Time:</strong> ${new Date(transaction.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</td></tr>
      ${transaction.customer ? `<tr><td colspan="2"><strong>Customer:</strong> ${transaction.customer.name} | Ph: ${transaction.customer.phone}</td></tr>` : ""}
      </table>
      <table>
        <thead><tr><th style="width:40%">Item</th><th style="width:15%">MRP</th><th style="width:10%;text-align:center">Qty</th><th style="width:15%;text-align:right">Price</th><th style="width:20%;text-align:right">Total</th></tr></thead>
        <tbody>
        ${transaction.items.map((item: any) => {
          const price = item.product.selling_price || item.product.price
          return `<tr><td>${item.product.name}<br/><small style="color:#888">${item.product.brand || ""} | HSN: ${item.product.hsn_code || ""}</small></td>
          <td>${item.product.mrp > price ? `<span style="text-decoration:line-through;color:#aaa">₹${item.product.mrp}</span>` : "-"}</td>
          <td style="text-align:center">${item.quantity}</td><td style="text-align:right">₹${price}</td><td style="text-align:right">₹${(price * item.quantity).toFixed(2)}</td></tr>`
        }).join("")}
        </tbody>
      </table>
      <table>
        <tr><td>Subtotal</td><td style="text-align:right">₹${transaction.subtotal.toFixed(2)}</td></tr>
        <tr><td>GST Amount</td><td style="text-align:right">₹${transaction.gst_amount.toFixed(2)}</td></tr>
        ${transaction.discount_amount > 0 ? `<tr><td>Discount</td><td style="text-align:right;color:green">-₹${transaction.discount_amount.toFixed(2)}</td></tr>` : ""}
        ${transaction.loyalty_discount_amount > 0 ? `<tr><td>Loyalty Discount</td><td style="text-align:right;color:green">-₹${transaction.loyalty_discount_amount.toFixed(2)}</td></tr>` : ""}
        ${savings > 0 ? `<tr><td class="savings">Total Savings 🎉</td><td style="text-align:right" class="savings">₹${savings.toFixed(2)}</td></tr>` : ""}
        <tr class="total-row"><td>TOTAL</td><td style="text-align:right">₹${transaction.total_amount.toFixed(2)}</td></tr>
        <tr><td>Payment Method</td><td style="text-align:right">${transaction.payment_method.toUpperCase()}</td></tr>
        ${transaction.cash_received ? `<tr><td>Cash Received</td><td style="text-align:right">₹${transaction.cash_received.toFixed(2)}</td></tr><tr><td>Change</td><td style="text-align:right">₹${(transaction.change_amount || 0).toFixed(2)}</td></tr>` : ""}
      </table>
      ${pdfQrHtml}
      ${transaction.customer && transaction.loyalty_points_earned > 0 ? `<div style="background:#f0f4ff;padding:10px;border-radius:6px;text-align:center;margin:12px 0;"><strong>⭐ Loyalty Points Earned: +${transaction.loyalty_points_earned}</strong><br/><small>Thank you for being a valued customer!</small></div>` : ""}
      <div class="footer">${storeSettings.receipt_footer || "Thank you for shopping with us! Visit again."}</div>
    </body></html>`
  }

  const totalSavings = calculateTotalSavings()

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Receipt — {transaction.invoice_number}
          </DialogTitle>
          <DialogDescription>Preview, print, or share this bill</DialogDescription>
        </DialogHeader>

        {/* Scrollable receipt preview — captured by html2canvas */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          ref={receiptRef}
          className="bg-white text-black p-4 font-mono text-xs border rounded overflow-y-auto flex-1"
        >
          {/* Store Header */}
          <div className="text-center mb-2">
            {effectiveLogo && (
              <img
                src={effectiveLogo}
                alt="Logo"
                className="h-12 mx-auto object-contain mb-1"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
              />
            )}
            <div className="font-bold text-sm">{storeSettings.store_name || "TECHNO BILLS"}</div>
            {storeSettings.store_address && <div className="text-gray-500 text-xs">{storeSettings.store_address}</div>}
            {storeSettings.store_phone && <div className="text-gray-500 text-xs">Ph: {storeSettings.store_phone}</div>}
            {storeSettings.gst_number && <div className="text-gray-500 text-xs">GSTIN: {storeSettings.gst_number}</div>}
          </div>

          <div className="border-t border-dashed border-gray-400 my-2" />

          <div className="mb-2 space-y-0.5">
            <div className="flex justify-between"><span>Bill No:</span><span className="font-bold">{transaction.invoice_number}</span></div>
            <div className="flex justify-between"><span>Date:</span><span>{new Date(transaction.created_at).toLocaleDateString("en-IN")}</span></div>
            <div className="flex justify-between"><span>Time:</span><span>{new Date(transaction.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span></div>
            <div className="flex justify-between"><span>Cashier:</span><span>{transaction.cashier?.full_name || "Staff"}</span></div>
            {transaction.customer && <>
              <div className="flex justify-between"><span>Customer:</span><span>{transaction.customer.name}</span></div>
              <div className="flex justify-between"><span>Phone:</span><span>{transaction.customer.phone}</span></div>
            </>}
          </div>

          <div className="border-t border-dashed border-gray-400 my-2" />

          <div className="grid grid-cols-4 gap-1 font-bold mb-1 text-xs">
            <span className="col-span-2">Item</span>
            <span className="text-center">Qty</span>
            <span className="text-right">Amt</span>
          </div>
          <div className="border-t border-dashed border-gray-400 my-1" />

          {transaction.items.map((item: any, index: number) => {
            const price = item.product.selling_price || item.product.price
            return (
              <div key={index} className="mb-1">
                <div className="grid grid-cols-4 gap-1 text-xs">
                  <span className="col-span-2 truncate">{item.product.name}</span>
                  <span className="text-center">{item.quantity}</span>
                  <span className="text-right">₹{(price * item.quantity).toFixed(2)}</span>
                </div>
                {item.product.mrp && item.product.mrp > price && (
                  <div className="text-xs text-green-600 col-span-4 ml-1">
                    Save: ₹{(item.product.mrp - price).toFixed(2)}/unit
                  </div>
                )}
              </div>
            )
          })}

          <div className="border-t border-dashed border-gray-400 my-2" />

          <div className="space-y-0.5 text-xs">
            <div className="flex justify-between"><span>Subtotal:</span><span>₹{transaction.subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>CGST:</span><span>₹{(transaction.gst_amount / 2).toFixed(2)}</span></div>
            <div className="flex justify-between"><span>SGST:</span><span>₹{(transaction.gst_amount / 2).toFixed(2)}</span></div>
            {transaction.discount_amount > 0 && <div className="flex justify-between text-green-600"><span>Discount ({transaction.discount_percentage?.toFixed(1)}%):</span><span>-₹{transaction.discount_amount.toFixed(2)}</span></div>}
            {transaction.loyalty_discount_amount > 0 && <div className="flex justify-between text-green-600"><span>Loyalty Discount:</span><span>-₹{transaction.loyalty_discount_amount.toFixed(2)}</span></div>}
            {totalSavings > 0 && <div className="flex justify-between text-green-600 font-semibold"><span>🎉 You Saved:</span><span>₹{totalSavings.toFixed(2)}</span></div>}
          </div>

          <div className="border-t border-dashed border-black my-2" />
          <div className="flex justify-between font-bold text-sm bg-gray-100 p-1.5 rounded">
            <span>TOTAL:</span><span>₹{transaction.total_amount.toFixed(2)}</span>
          </div>
          <div className="border-t border-dashed border-black my-2" />

          <div className="text-xs space-y-0.5">
            {transaction.payment_method === "cash" ? <>
              <div className="flex justify-between"><span>Cash Paid:</span><span>₹{transaction.cash_received?.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Change:</span><span>₹{transaction.change_amount?.toFixed(2)}</span></div>
            </> : (
              <div className="flex justify-between"><span>Payment:</span><span>{transaction.payment_method.toUpperCase()}</span></div>
            )}
          </div>

          {/* UPI QR Preview */}
          {effectiveQr ? (
            <div className="text-center mt-2 border border-dashed border-gray-300 rounded p-2">
              <div className="text-xs font-bold mb-1">Scan to Pay via UPI</div>
              <img src={effectiveQr} alt="UPI QR" className="w-20 h-20 mx-auto" />
              <div className="text-xs text-gray-500 mt-1">{storeSettings.upi_id}</div>
            </div>
          ) : upiQrUrl ? (
            <div className="text-center mt-2 border border-dashed border-gray-300 rounded p-2">
              <div className="text-xs font-bold mb-1">Scan to Pay via UPI</div>
              <img src={upiQrUrl} alt="UPI QR" className="w-20 h-20 mx-auto" />
              <div className="text-xs text-gray-500 mt-1">{storeSettings.upi_id}</div>
            </div>
          ) : null}

          {/* Loyalty */}
          {transaction.customer && transaction.loyalty_points_earned > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-2 bg-purple-50 p-2 rounded text-center"
            >
              <div className="flex items-center justify-center gap-1 text-purple-700 font-bold text-xs">
                <Gift className="h-3 w-3" /> LOYALTY POINTS
              </div>
              <Badge className="bg-purple-600 text-white mt-1">+{transaction.loyalty_points_earned} pts earned</Badge>
            </motion.div>
          )}

          <div className="border-t border-dashed border-gray-400 my-2" />
          <div className="text-center text-xs">{storeSettings.receipt_footer || "Thank You! Visit Again!"}</div>
        </motion.div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 mt-3">
          <Button onClick={printThermalReceipt} className="bg-blue-600 hover:bg-blue-700 text-xs">
            <Printer className="h-3.5 w-3.5 mr-1.5" />
            Thermal Print
          </Button>
          <Button onClick={generatePDFReceipt} variant="outline" className="text-xs bg-transparent">
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            PDF Invoice
          </Button>

          {/* ── PRIMARY: Share as image on WhatsApp ── */}
          <Button
            onClick={shareAsWhatsAppImage}
            disabled={capturingImage}
            className="bg-green-600 hover:bg-green-700 text-xs col-span-2"
          >
            {capturingImage
              ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Capturing…</>
              : <><ImageDown className="h-3.5 w-3.5 mr-1.5" /> Share Bill as Image (WhatsApp)</>
            }
          </Button>

          {/* ── SECONDARY: Text share ── */}
          <Button
            onClick={shareTextOnWhatsApp}
            variant="outline"
            className="text-xs col-span-2 border-green-600/40 text-green-700 hover:bg-green-50 dark:hover:bg-green-950/20"
          >
            <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
            Share as Text Message
          </Button>
        </div>

        <Button variant="ghost" onClick={onClose} className="w-full mt-1 text-xs">
          <X className="h-3.5 w-3.5 mr-1.5" /> Close
        </Button>
      </DialogContent>
    </Dialog>
  )
}
