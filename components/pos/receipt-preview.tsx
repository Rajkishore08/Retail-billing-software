"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase-client"
import { Printer, Gift, FileText } from "lucide-react"
import { motion } from "framer-motion"

type ReceiptProps = {
  transaction: any
  onClose: () => void
}

export function ReceiptPreview({ transaction, onClose }: ReceiptProps) {
  const [storeSettings, setStoreSettings] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchStoreSettings()
  }, [])

  // Calculate total savings including MRP to selling price difference
  const calculateTotalSavings = () => {
    let totalSavings = 0
    
    // Add discount savings
    totalSavings += transaction.discount_amount || 0
    totalSavings += transaction.loyalty_discount_amount || 0
    
    // Add MRP to selling price savings
    if (transaction.items) {
      transaction.items.forEach((item: any) => {
        if (item.product.mrp && item.product.selling_price) {
          const mrpSavings = (item.product.mrp - item.product.selling_price) * item.quantity
          totalSavings += mrpSavings
        }
      })
    }
    
    return totalSavings
  }

  const fetchStoreSettings = async () => {
    const { data } = await supabase.from("settings").select("key, value")

    if (data) {
      const settings = data.reduce(
        (acc, setting) => {
          acc[setting.key] = setting.value
          return acc
        },
        {} as Record<string, string>,
      )
      setStoreSettings(settings)
    }
  }

  const printThermalReceipt = () => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    const receiptHtml = generateThermalReceiptHTML()
    printWindow.document.write(receiptHtml)
    printWindow.document.close()
    printWindow.print()
  }

  const generatePDFReceipt = () => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    const pdfHtml = generatePDFReceiptHTML()
    printWindow.document.write(pdfHtml)
    printWindow.document.close()
    printWindow.print()
  }

  const generateThermalReceiptHTML = () => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Receipt</title>
        <style>
          body { font-family: monospace; font-size: 12px; margin: 0; padding: 10px; }
          .header { text-align: center; margin-bottom: 10px; }
          .title { font-size: 16px; font-weight: bold; margin-bottom: 5px; }
          .subtitle { font-size: 12px; color: #666; }
          .row { display: flex; justify-content: space-between; margin: 2px 0; }
          .item { margin: 5px 0; }
          .item-name { font-weight: bold; }
          .item-details { font-size: 10px; color: #666; }
          .line { border-top: 1px dashed #000; margin: 5px 0; }
          .total { font-weight: bold; font-size: 14px; }
          .loyalty-box { border: 1px solid #000; padding: 5px; margin: 10px 0; text-align: center; }
          .bold { font-weight: bold; }
          .footer { text-align: center; margin-top: 10px; font-size: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">NATIONAL MINI MART</div>
          <div class="subtitle">Your Trusted Store</div>
          <div class="subtitle">Bill No: ${transaction.invoice_number}</div>
          <div class="subtitle">Date: ${new Date(transaction.created_at).toLocaleDateString()}</div>
          <div class="subtitle">Time: ${new Date(transaction.created_at).toLocaleTimeString()}</div>
          ${transaction.customer ? `<div class="subtitle">Customer: ${transaction.customer.name}</div>` : ''}
        </div>
        
        <div class="line"></div>
        
        <div class="row" style="font-weight: bold; margin-bottom: 5px;">
          <span style="width: 40%;">Item</span>
          <span style="width: 20%; text-align: center;">MRP</span>
          <span style="width: 20%; text-align: center;">Qty</span>
          <span style="width: 20%; text-align: right;">Amount</span>
        </div>
        ${transaction.items.map((item: any) => `
          <div class="item">
            <div class="row">
              <span style="width: 40%;">${item.product.name}</span>
              <span style="width: 20%; text-align: center; font-size: 10px;">
                ${item.product.mrp && item.product.mrp > (item.product.selling_price || item.product.price) ? 
                  `<span>₹${item.product.mrp}</span>` : '-'}
              </span>
              <span style="width: 20%; text-align: center;">${item.quantity}</span>
              <span style="width: 20%; text-align: right;">₹${((item.product.selling_price || item.product.price) * item.quantity).toFixed(2)}</span>
            </div>
            <div class="item-details" style="margin-left: 5px; font-size: 9px;">
              ${item.product.brand} • HSN: ${item.product.hsn_code} • ${item.product.gst_rate}% GST
              ${item.product.mrp && item.product.mrp > (item.product.selling_price || item.product.price) ? 
                `<br><span style="color: #22c55e;">Save: ₹${(item.product.mrp - (item.product.selling_price || item.product.price)).toFixed(2)}</span>` : ''}
            </div>
          </div>
        `).join('')}
        
        <div class="line"></div>
        
        <div class="row">
          <span>Subtotal:</span>
          <span>₹${transaction.subtotal.toFixed(2)}</span>
        </div>
        <div class="row">
          <span>GST Amount:</span>
          <span>₹${transaction.gst_amount.toFixed(2)}</span>
        </div>
        ${transaction.discount_amount > 0 ? `
        <div class="row">
          <span>Discount (${transaction.discount_percentage?.toFixed(2) || '0'}%):</span>
          <span>-₹${transaction.discount_amount.toFixed(2)}</span>
        </div>
        ` : ''}
        ${transaction.loyalty_discount_amount > 0 ? `
        <div class="row">
          <span>Loyalty Discount:</span>
          <span>-₹${transaction.loyalty_discount_amount.toFixed(2)}</span>
        </div>
        ` : ''}
        ${transaction.rounding_adjustment !== 0 ? `
        <div class="row">
          <span>Rounding:</span>
          <span>₹${transaction.rounding_adjustment.toFixed(2)}</span>
        </div>
        ` : ''}
        ${(() => {
          let totalSavings = 0
          totalSavings += transaction.discount_amount || 0
          totalSavings += transaction.loyalty_discount_amount || 0
          
          if (transaction.items) {
            transaction.items.forEach((item: any) => {
              if (item.product.mrp && item.product.selling_price) {
                const mrpSavings = (item.product.mrp - item.product.selling_price) * item.quantity
                totalSavings += mrpSavings
              }
            })
          }
          
          return totalSavings > 0 ? `
          <div class="row">
            <span>Total Savings:</span>
            <span>₹${totalSavings.toFixed(2)}</span>
          </div>
          ` : ''
        })()}
        <div class="line"></div>
        <div class="row total">
          <span>TOTAL:</span>
          <span>₹${transaction.total_amount.toFixed(2)}</span>
        </div>
        <div class="line"></div>
        
        <div class="row">
          <span>Payment Method:</span>
          <span>${transaction.payment_method.toUpperCase()}</span>
        </div>
        ${transaction.cash_received ? `
        <div class="row">
          <span>Cash Received:</span>
          <span>₹${transaction.cash_received.toFixed(2)}</span>
        </div>
        <div class="row">
          <span>Change:</span>
          <span>₹${transaction.change_amount?.toFixed(2) || '0.00'}</span>
        </div>
        ` : ''}
        
        ${transaction.customer && (transaction.loyalty_points_earned > 0 || transaction.loyalty_points_redeemed > 0)
          ? `
        <div class="line"></div>
        <div class="loyalty-box">
          <div class="bold">LOYALTY POINTS</div>
          ${transaction.loyalty_points_earned > 0 ? `<div>Points Earned: +${transaction.loyalty_points_earned}</div>` : ''}
          ${transaction.loyalty_points_redeemed > 0 ? `<div>Points Redeemed: -${transaction.loyalty_points_redeemed}</div>` : ''}
          <div>Thank you for your loyalty!</div>
        </div>
        `
          : ""
        }
        
        <div class="line"></div>
        
        <div class="footer">
          <div>Thank you for shopping with us!</div>
          <div>Visit again</div>
        </div>
      </body>
      </html>
    `
  }

  const generatePDFReceiptHTML = () => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Receipt</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; max-width: 400px; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
          .title { font-size: 24px; font-weight: bold; margin-bottom: 5px; color: #333; }
          .subtitle { font-size: 14px; color: #666; margin: 2px 0; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background-color: #f8f9fa; font-weight: bold; }
          .item-details { font-size: 12px; color: #666; margin-top: 2px; }
          .total-row { font-weight: bold; font-size: 16px; background-color: #f8f9fa; }
          .loyalty-section { background-color: #f0f8ff; padding: 10px; margin: 15px 0; border-radius: 5px; }
          .footer { text-align: center; margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">NATIONAL MINI MART</div>
          <div class="subtitle">Your Trusted Store</div>
          <div class="subtitle">Bill No: ${transaction.invoice_number}</div>
          <div class="subtitle">Date: ${new Date(transaction.created_at).toLocaleDateString()}</div>
          <div class="subtitle">Time: ${new Date(transaction.created_at).toLocaleTimeString()}</div>
          ${transaction.customer ? `<div class="subtitle">Customer: ${transaction.customer.name}</div>` : ''}
        </div>
        
        <table style="width: 100%;">
          <thead>
            <tr>
              <th style="width: 35%; text-align: left;">Item</th>
              <th style="width: 15%; text-align: center;">MRP</th>
              <th style="width: 10%; text-align: center;">Qty</th>
              <th style="width: 20%; text-align: center;">Price</th>
              <th style="width: 20%; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${transaction.items.map((item: any) => `
              <tr>
                <td style="text-align: left;">
                  <div>${item.product.name}</div>
                  <div class="item-details">${item.product.brand} • HSN: ${item.product.hsn_code}</div>
                </td>
                <td style="text-align: center;">
                  ${item.product.mrp && item.product.mrp > (item.product.selling_price || item.product.price) ? 
                    `<span style="color: #333;">₹${item.product.mrp}</span>` : 
                    `<span style="color: #999;">-</span>`}
                </td>
                <td style="text-align: center;">${item.quantity}</td>
                <td style="text-align: center;">₹${item.product.selling_price || item.product.price}</td>
                <td style="text-align: right;">₹${((item.product.selling_price || item.product.price) * item.quantity).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <table>
          <tr>
            <td>Subtotal:</td>
            <td class="text-right">₹${transaction.subtotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td>GST Amount:</td>
            <td class="text-right">₹${transaction.gst_amount.toFixed(2)}</td>
          </tr>
          ${transaction.discount_amount > 0 ? `
          <tr>
            <td>Discount (${transaction.discount_percentage?.toFixed(2) || '0.00'}%):</td>
            <td class="text-right">-₹${transaction.discount_amount.toFixed(2)}</td>
          </tr>
          ` : ''}
          ${transaction.loyalty_discount_amount > 0 ? `
          <tr>
            <td>Loyalty Discount:</td>
            <td class="text-right">-₹${transaction.loyalty_discount_amount.toFixed(2)}</td>
          </tr>
          ` : ''}
          ${transaction.rounding_adjustment !== 0 ? `
          <tr>
            <td>Rounding:</td>
            <td class="text-right">₹${transaction.rounding_adjustment.toFixed(2)}</td>
          </tr>
          ` : ''}
          ${(() => {
            let totalSavings = 0
            totalSavings += transaction.discount_amount || 0
            totalSavings += transaction.loyalty_discount_amount || 0
            
            if (transaction.items) {
              transaction.items.forEach((item: any) => {
                if (item.product.mrp && item.product.selling_price) {
                  const mrpSavings = (item.product.mrp - item.product.selling_price) * item.quantity
                  totalSavings += mrpSavings
                }
              })
            }
            
            return totalSavings > 0 ? `
            <tr>
              <td><strong>Total Savings:</strong></td>
              <td class="text-right"><strong>₹${totalSavings.toFixed(2)}</strong></td>
            </tr>
            ` : ''
          })()}
          <tr style="border-top: 2px dashed #333; border-bottom: 2px dashed #333;">
            <td style="font-weight: bold; font-size: 18px; padding: 10px 8px;">TOTAL:</td>
            <td class="text-right" style="font-weight: bold; font-size: 18px; padding: 10px 8px;">₹${transaction.total_amount.toFixed(2)}</td>
          </tr>
        </table>
        
        <div style="margin: 15px 0;">
          <strong>Payment Method:</strong> ${transaction.payment_method.toUpperCase()}
          ${transaction.cash_received ? `
          <br><strong>Cash Received:</strong> ₹${transaction.cash_received.toFixed(2)}
          <br><strong>Change:</strong> ₹${transaction.change_amount?.toFixed(2) || '0.00'}
          ` : ''}
        </div>
        
        ${transaction.customer && (transaction.loyalty_points_earned > 0 || transaction.loyalty_points_redeemed > 0)
          ? `
        <div class="loyalty-section">
          <h3 style="margin: 0 0 10px 0; color: #6366f1;">🎁 LOYALTY REWARDS</h3>
          ${transaction.loyalty_points_earned > 0 ? `<p style="margin: 5px 0; font-size: 16px;"><strong>Points Earned: +${transaction.loyalty_points_earned}</strong></p>` : ''}
          ${transaction.loyalty_points_redeemed > 0 ? `<p style="margin: 5px 0; font-size: 16px;"><strong>Points Redeemed: -${transaction.loyalty_points_redeemed}</strong></p>` : ''}
          <p style="margin: 5px 0;">Thank you for being a valued customer!</p>
        </div>
        `
          : ""
        }
        
        <div class="footer">
          <div style="font-size: 16px; margin-bottom: 5px;">Thank you for shopping with us!</div>
          <div>Visit again</div>
        </div>
      </body>
      </html>
    `
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Receipt Preview</DialogTitle>
          <DialogDescription>
            Preview and print transaction receipt
          </DialogDescription>
        </DialogHeader>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white text-black p-4 font-mono text-xs border rounded max-h-96 overflow-y-auto"
        >
          <div className="text-center font-bold mb-2">
            ================================
            <br />
            {storeSettings.store_name || "NATIONAL MINI MART"}
            <br />
            {storeSettings.store_address}
            <br />
            {storeSettings.store_phone}
            <br />
            GST: {storeSettings.gst_number}
            <br />
            ================================
          </div>

          <div className="border-t border-dashed border-gray-400 my-2"></div>

          <div className="mb-2">
            Date: {new Date(transaction.created_at).toLocaleDateString("en-IN")}{" "}
            {new Date(transaction.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            <br />
            Bill No: {transaction.invoice_number}
            <br />
            Cashier: {transaction.cashier?.full_name || "Staff"}
            <br />
            {transaction.customer && `Customer: ${transaction.customer.name}`}
            <br />
            {transaction.customer && `Phone: ${transaction.customer.phone}`}
            <br />
          </div>

          <div className="border-t border-dashed border-gray-400 my-2"></div>

          <div className="grid grid-cols-4 gap-2 font-bold mb-1">
            <span>Item</span>
            <span className="text-center">MRP</span>
            <span className="text-center">Qty</span>
            <span className="text-right">Amount</span>
          </div>

          <div className="border-t border-dashed border-gray-400 my-2"></div>

          {transaction.items.map((item: any, index: number) => (
            <div key={index} className="mb-1">
              <div className="grid grid-cols-4 gap-2">
                <span className="truncate">{item.product.name}</span>
                <span className="text-center text-xs">
                  {item.product.mrp && item.product.mrp > (item.product.selling_price || item.product.price) ? (
                    <span>₹{item.product.mrp}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </span>
                <span className="text-center">{item.quantity}</span>
                <span className="text-right">₹{item.total.toFixed(2)}</span>
              </div>
              {item.product.mrp && item.product.mrp > (item.product.selling_price || item.product.price) && (
                <div className="text-xs text-green-600 col-span-4 ml-2">
                  Save: ₹{(item.product.mrp - (item.product.selling_price || item.product.price)).toFixed(2)}
                </div>
              )}
            </div>
          ))}

          <div className="border-t border-dashed border-gray-400 my-2"></div>

          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>₹{transaction.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>CGST (9%):</span>
              <span>₹{(transaction.gst_amount / 2).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>SGST (9%):</span>
              <span>₹{(transaction.gst_amount / 2).toFixed(2)}</span>
            </div>
            {transaction.discount_amount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount ({transaction.discount_percentage?.toFixed(2) || '0.00'}%):</span>
                <span>-₹{transaction.discount_amount.toFixed(2)}</span>
              </div>
            )}
            {transaction.loyalty_discount_amount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Loyalty Discount:</span>
                <span>-₹{transaction.loyalty_discount_amount.toFixed(2)}</span>
              </div>
            )}
            {transaction.rounding_adjustment !== 0 && (
              <div className="flex justify-between text-sm text-gray-500">
                <span>Rounding:</span>
                <span>₹{transaction.rounding_adjustment.toFixed(2)}</span>
              </div>
            )}
            {calculateTotalSavings() > 0 && (
              <div className="flex justify-between text-sm text-green-600 font-semibold">
                <span>Total Savings:</span>
                <span>₹{calculateTotalSavings().toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-dashed border-black my-2"></div>
            <div className="flex justify-between font-bold text-lg bg-gray-100 p-2 rounded">
              <span>Total:</span>
              <span>₹{transaction.total_amount.toFixed(2)}</span>
            </div>
            <div className="border-t border-dashed border-black my-2"></div>

            {transaction.payment_method === "cash" && (
              <>
                <div className="flex justify-between">
                  <span>Cash:</span>
                  <span>₹{transaction.cash_received.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Change:</span>
                  <span>₹{transaction.change_amount.toFixed(2)}</span>
                </div>
              </>
            )}

            {transaction.payment_method !== "cash" && (
              <div className="flex justify-between">
                <span>Payment:</span>
                <span>{transaction.payment_method.toUpperCase()}</span>
              </div>
            )}
          </div>

          {transaction.customer && (transaction.loyalty_points_earned > 0 || transaction.loyalty_points_redeemed > 0) && (
            <>
              <div className="border-t border-dashed border-gray-400 my-2"></div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-center bg-purple-50 p-2 rounded"
              >
                <div className="flex items-center justify-center mb-1">
                  <Gift className="h-4 w-4 mr-1 text-purple-600" />
                  <span className="font-bold text-purple-800">LOYALTY POINTS</span>
                </div>
                <div className="text-purple-700">
                  Points Earned:{" "}
                  <Badge className="bg-purple-600 text-white">+{transaction.loyalty_points_earned}</Badge>
                </div>
                <div className="text-xs text-purple-600 mt-1">Thank you for your loyalty!</div>
              </motion.div>
            </>
          )}

          <div className="border-t border-dashed border-gray-400 my-2"></div>

          <div className="text-center">
            {storeSettings.receipt_footer || "Thank You! Visit Again!"}
            <br />
            ================================
          </div>
        </motion.div>

        <div className="flex gap-2 mt-4">
          <Button onClick={printThermalReceipt} className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600">
            <Printer className="h-4 w-4 mr-2" />
            Print 3" Thermal
          </Button>
          <Button onClick={generatePDFReceipt} variant="outline" className="flex-1 bg-transparent">
            <FileText className="h-4 w-4 mr-2" />
            PDF Invoice
          </Button>
        </div>

        <Button variant="outline" onClick={onClose} className="w-full mt-2 bg-transparent">
          Close
        </Button>
      </DialogContent>
    </Dialog>
  )
}
