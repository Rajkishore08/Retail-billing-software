"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { supabase } from "@/lib/supabase-client"
import { useAuth } from "@/contexts/auth-context"
import { Edit, Save, X, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

interface TransactionItem {
  id: string
  product_name: string
  quantity: number
  unit_price: number
  total_price: number
  gst_rate: number
}

interface Transaction {
  id: string
  invoice_number: string
  customer_name: string | null
  customer_phone: string | null
  subtotal: number
  gst_amount: number
  total_amount: number
  payment_method: string
  cash_received: number | null
  change_amount: number | null
  status: string
  created_at: string
  cashier: { full_name: string } | null
  customer: { name: string; phone: string } | null
  transaction_items: TransactionItem[]
}

interface EditTransactionModalProps {
  transaction: Transaction | null
  isOpen: boolean
  onClose: () => void
  onTransactionUpdated: () => void
}

export function EditTransactionModal({ transaction, isOpen, onClose, onTransactionUpdated }: EditTransactionModalProps) {
  const { profile } = useAuth()
  const [isSaving, setIsSaving] = useState(false)
  const [editedTransaction, setEditedTransaction] = useState<Transaction | null>(null)

  const isAdmin = profile?.role === 'admin'

  // Initialize edited transaction when modal opens
  useEffect(() => {
    if (transaction && isOpen) {
      setEditedTransaction({ ...transaction })
    }
  }, [transaction, isOpen])

  const handleSave = async () => {
    if (!editedTransaction || !isAdmin) return

    setIsSaving(true)
    try {
      // Update transaction
      const { error: transactionError } = await supabase
        .from('transactions')
        .update({
          customer_name: editedTransaction.customer_name,
          customer_phone: editedTransaction.customer_phone,
          payment_method: editedTransaction.payment_method,
          status: editedTransaction.status,
          cash_received: editedTransaction.cash_received,
          change_amount: editedTransaction.cash_received ? editedTransaction.cash_received - editedTransaction.total_amount : null
        })
        .eq('id', editedTransaction.id)

      if (transactionError) throw transactionError

      // Update transaction items
      for (const item of editedTransaction.transaction_items) {
        const { error: itemError } = await supabase
          .from('transaction_items')
          .update({
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price
          })
          .eq('id', item.id)

        if (itemError) throw itemError
      }

      toast.success("Transaction updated successfully")
      onTransactionUpdated()
      onClose()
    } catch (error) {
      console.error("Error updating transaction:", error)
      toast.error("Failed to update transaction")
    } finally {
      setIsSaving(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  if (!transaction || !editedTransaction) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Edit Transaction
          </DialogTitle>
          <DialogDescription>
            Edit transaction details and items
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="customer-name">Customer Name</Label>
                  <Input
                    id="customer-name"
                    value={editedTransaction.customer_name || ""}
                    onChange={(e) => setEditedTransaction({
                      ...editedTransaction,
                      customer_name: e.target.value
                    })}
                    placeholder="Customer name"
                  />
                </div>
                <div>
                  <Label htmlFor="customer-phone">Phone Number</Label>
                  <Input
                    id="customer-phone"
                    value={editedTransaction.customer_phone || ""}
                    onChange={(e) => setEditedTransaction({
                      ...editedTransaction,
                      customer_phone: e.target.value
                    })}
                    placeholder="Phone number"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="payment-method">Payment Method</Label>
                  <Select
                    value={editedTransaction.payment_method}
                    onValueChange={(value) => setEditedTransaction({
                      ...editedTransaction,
                      payment_method: value
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={editedTransaction.status}
                    onValueChange={(value) => setEditedTransaction({
                      ...editedTransaction,
                      status: value
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="cash-received">Cash Received</Label>
                  <Input
                    id="cash-received"
                    type="number"
                    value={editedTransaction.cash_received || ""}
                    onChange={(e) => setEditedTransaction({
                      ...editedTransaction,
                      cash_received: e.target.value ? parseFloat(e.target.value) : null
                    })}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Items</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {editedTransaction.transaction_items?.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Input
                          value={item.product_name}
                          onChange={(e) => {
                            const newItems = [...editedTransaction.transaction_items]
                            newItems[index] = { ...item, product_name: e.target.value }
                            setEditedTransaction({
                              ...editedTransaction,
                              transaction_items: newItems
                            })
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => {
                            const newItems = [...editedTransaction.transaction_items]
                            const quantity = parseInt(e.target.value) || 0
                            newItems[index] = { 
                              ...item, 
                              quantity,
                              total_price: quantity * item.unit_price
                            }
                            setEditedTransaction({
                              ...editedTransaction,
                              transaction_items: newItems
                            })
                          }}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          value={item.unit_price}
                          onChange={(e) => {
                            const newItems = [...editedTransaction.transaction_items]
                            const unitPrice = parseFloat(e.target.value) || 0
                            newItems[index] = { 
                              ...item, 
                              unit_price: unitPrice,
                              total_price: item.quantity * unitPrice
                            }
                            setEditedTransaction({
                              ...editedTransaction,
                              transaction_items: newItems
                            })
                          }}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.total_price)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const newItems = editedTransaction.transaction_items.filter((_, i) => i !== index)
                            setEditedTransaction({
                              ...editedTransaction,
                              transaction_items: newItems
                            })
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Subtotal:</span>
                  <span className="font-medium">
                    {formatCurrency(editedTransaction.transaction_items.reduce((sum, item) => sum + item.total_price, 0))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">GST Amount:</span>
                  <span className="font-medium">{formatCurrency(editedTransaction.gst_amount)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-green-600">
                  <span>Total Amount:</span>
                  <span>{formatCurrency(editedTransaction.total_amount)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 