"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { supabase } from "@/lib/supabase-client"
import { useAuth } from "@/contexts/auth-context"
import { Eye, Edit, Trash2, Receipt, User, Calendar, CreditCard, IndianRupee } from "lucide-react"
import { toast } from "sonner"
import { EditTransactionModal } from "./edit-transaction-modal"

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

interface TransactionDetailsModalProps {
  transaction: Transaction | null
  isOpen: boolean
  onClose: () => void
  onTransactionUpdated: () => void
}

export function TransactionDetailsModal({ transaction, isOpen, onClose, onTransactionUpdated }: TransactionDetailsModalProps) {
  const { profile } = useAuth()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  const isAdmin = profile?.role === 'admin'

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getPaymentMethodColor = (method: string) => {
    switch (method) {
      case "cash":
        return "bg-green-100 text-green-800"
      case "card":
        return "bg-blue-100 text-blue-800"
      case "upi":
        return "bg-purple-100 text-purple-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const handleDelete = async () => {
    if (!transaction || !isAdmin) return

    setIsDeleting(true)
    try {
      // Delete transaction items first (due to foreign key constraint)
      const { error: itemsError } = await supabase
        .from('transaction_items')
        .delete()
        .eq('transaction_id', transaction.id)

      if (itemsError) throw itemsError

      // Delete the transaction
      const { error: transactionError } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transaction.id)

      if (transactionError) throw transactionError

      toast.success("Transaction deleted successfully")
      onTransactionUpdated()
      onClose()
    } catch (error) {
      console.error("Error deleting transaction:", error)
      toast.error("Failed to delete transaction")
    } finally {
      setIsDeleting(false)
      setIsDeleteDialogOpen(false)
    }
  }

  const handleEdit = () => {
    setIsEditModalOpen(true)
  }

  if (!transaction) return null

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Transaction Details
          </DialogTitle>
          <DialogDescription>
            View and manage transaction details
          </DialogDescription>
        </DialogHeader>

          <div className="space-y-6">
            {/* Header Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Receipt className="h-4 w-4" />
                    Invoice Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Invoice Number:</span>
                    <span className="font-medium">{transaction.invoice_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Date:</span>
                    <span className="font-medium">{formatDate(transaction.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <Badge className={getStatusColor(transaction.status)}>
                      {transaction.status.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Cashier:</span>
                    <span className="font-medium">{transaction.cashier?.full_name || "Unknown"}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Customer Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Name:</span>
                    <span className="font-medium">
                      {transaction.customer?.name || transaction.customer_name || "Walk-in Customer"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Phone:</span>
                    <span className="font-medium">
                      {transaction.customer?.phone || transaction.customer_phone || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Payment Method:</span>
                    <Badge className={getPaymentMethodColor(transaction.payment_method)}>
                      {transaction.payment_method.toUpperCase()}
                    </Badge>
                  </div>
                  {transaction.cash_received && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Cash Received:</span>
                      <span className="font-medium">{formatCurrency(transaction.cash_received)}</span>
                    </div>
                  )}
                  {transaction.change_amount && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Change:</span>
                      <span className="font-medium">{formatCurrency(transaction.change_amount)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

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
                      <TableHead className="text-right">GST Rate</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transaction.transaction_items?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.product_name}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                        <TableCell className="text-right">{item.gst_rate}%</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(item.total_price)}</TableCell>
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
                    <span className="font-medium">{formatCurrency(transaction.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">GST Amount:</span>
                    <span className="font-medium">{formatCurrency(transaction.gst_amount)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold text-green-600">
                    <span>Total Amount:</span>
                    <span>{formatCurrency(transaction.total_amount)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            {isAdmin && (
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={() => setIsDeleteDialogOpen(true)}
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Transaction Modal */}
      <EditTransactionModal
        transaction={transaction}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onTransactionUpdated={onTransactionUpdated}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this transaction? This action cannot be undone.
              The transaction and all its items will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
} 