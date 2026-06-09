"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { supabase } from "@/lib/supabase-client"
import { useAuth } from "@/contexts/auth-context"
import { CustomerSelector } from "./customer-selector"
import { ReceiptPreview } from "./receipt-preview"
import { LoyaltyRedemption } from "./loyalty-redemption"
import { DiscountManager } from "./discount-manager"
import { Search, Plus, Minus, Trash2, CreditCard, Smartphone, Banknote, Receipt, Tag, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Product = {
  id: string
  name: string
  price: number
  cost_price: number
  mrp: number
  selling_price: number
  stock_quantity: number
  gst_rate: number
  price_includes_gst: boolean
  hsn_code: string
  brand: string
  barcode?: string
}

type CartItem = {
  product: Product
  quantity: number
  total: number
}

type Customer = {
  id: string
  name: string
  phone: string
  email: string | null
  loyalty_points: number
  total_spent: number
  outstanding_credit?: number
}

type PaymentMethod = "cash" | "card" | "upi" | "credit"

export function POSInterface() {
  const { profile } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedBrand, setSelectedBrand] = useState<string>("all")
  const [brands, setBrands] = useState<string[]>([])
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash")
  const [cashReceived, setCashReceived] = useState("")
  const [loading, setLoading] = useState(false)
  const [productsLoading, setProductsLoading] = useState(true)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showReceipt, setShowReceipt] = useState(false)
  const [lastTransaction, setLastTransaction] = useState<any>(null)
  const lastBillNumberRef = useRef<string>("NM 0000")
  
  // Loyalty redemption state
  const [loyaltyPointsRedeemed, setLoyaltyPointsRedeemed] = useState(0)
  const [loyaltyDiscountAmount, setLoyaltyDiscountAmount] = useState(0)

  // Discount state
  const [discountAmount, setDiscountAmount] = useState(0)
  const [discountPercentage, setDiscountPercentage] = useState(0)

  // Barcode scanner state
  const [isScanning, setIsScanning] = useState(false)
  const barcodeInputRef = useRef<HTMLInputElement>(null)

  // Memoized filtered products for better performance
  const filteredProducts = useMemo(() => {
    let filtered = products
    
    // Filter by brand
    if (selectedBrand !== "all") {
      filtered = filtered.filter(product => product.brand === selectedBrand)
    }
    
    // Filter by search term (combined product search and barcode)
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (product) => 
          product.name.toLowerCase().includes(searchLower) || 
          product.barcode?.includes(searchLower) ||
          product.brand.toLowerCase().includes(searchLower) ||
          product.hsn_code.includes(searchLower)
      )
    }
    
    return filtered
  }, [products, searchTerm, selectedBrand])

  // Memoized totals calculation
  const totals = useMemo(() => {
    // Calculate base amounts and GST breakdown
    let baseSubtotal = 0
    let gstAmount = 0
    
    cart.forEach((item) => {
      if (item.product.price_includes_gst) {
        // Price includes GST - extract GST amount
        const sellingPrice = item.product.selling_price || item.product.price
        const priceWithoutGst = sellingPrice / (1 + item.product.gst_rate / 100)
        const itemGst = sellingPrice - priceWithoutGst
        const itemBasePrice = priceWithoutGst
        
        baseSubtotal += itemBasePrice * item.quantity
        gstAmount += itemGst * item.quantity
      } else {
        // Price excludes GST - add GST amount
        const itemBasePrice = item.product.selling_price || item.product.price
        const itemGst = (itemBasePrice * item.product.gst_rate / 100)
        
        baseSubtotal += itemBasePrice * item.quantity
        gstAmount += itemGst * item.quantity
      }
    })
    
    const total = baseSubtotal + gstAmount
    
    // Apply loyalty discount
    const totalAfterLoyalty = total - loyaltyDiscountAmount
    
    // Apply manual discount
    const totalAfterDiscount = totalAfterLoyalty - discountAmount
    
    // Round the total to nearest rupee (no paise)
    const roundedTotal = Math.round(totalAfterDiscount)
    const roundingAdjustment = roundedTotal - totalAfterDiscount

    return { 
      subtotal: baseSubtotal, 
      gstAmount, 
      total, 
      totalAfterLoyalty,
      totalAfterDiscount,
      roundedTotal, 
      roundingAdjustment 
    }
  }, [cart, loyaltyDiscountAmount, discountAmount])

  const { subtotal, gstAmount, total, totalAfterLoyalty, totalAfterDiscount, roundedTotal, roundingAdjustment } = totals
  const changeAmount = paymentMethod === "cash" ? Math.max(0, Number.parseFloat(cashReceived || "0") - roundedTotal) : 0
  const loyaltyPointsEarned = Math.floor(roundedTotal / 100)

  // Calculate total savings including MRP to selling price difference
  const calculateTotalSavings = () => {
    let totalSavings = 0
    
    // Add discount savings
    totalSavings += discountAmount
    totalSavings += loyaltyDiscountAmount
    
    // Add MRP to selling price savings
    cart.forEach((item) => {
      if (item.product.mrp && item.product.selling_price) {
        const mrpSavings = (item.product.mrp - item.product.selling_price) * item.quantity
        totalSavings += mrpSavings
      }
    })
    
    return totalSavings
  }

  const fetchProducts = useCallback(async () => {
    try {
      setProductsLoading(true)
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .gt('stock_quantity', 0)
        .order('name')

      if (error) {
        console.error("Error fetching products:", error)
        return
      }

      setProducts(data || [])
      const uniqueBrands = [...new Set((data || []).map((p: Product) => p.brand || 'Generic'))].sort() as string[]
      setBrands(uniqueBrands)
    } catch (error) {
      console.error("Error in fetchProducts:", error)
    } finally {
      setProductsLoading(false)
    }
  }, [])

  const fetchLastBillNumber = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_last_bill_number')

      if (error) {
        // Fallback to direct query if RPC fails
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('transactions')
          .select('invoice_number')
          .like('invoice_number', 'NM %')
          .order('invoice_number', { ascending: false })
          .limit(1)
          .single()
        
        if (fallbackError) {
          lastBillNumberRef.current = 'NM 0000'
          return
        }
        
        if (fallbackData?.invoice_number) {
          lastBillNumberRef.current = fallbackData.invoice_number
        }
        return
      }

      if (data) {
        lastBillNumberRef.current = data
      }
    } catch (error) {
      lastBillNumberRef.current = 'NM 0000'
    }
  }, [])

  const getNextBillNumber = useCallback(() => {
    const currentNumber = parseInt(lastBillNumberRef.current.replace("NM ", ""))
    const nextNumber = currentNumber + 1
    const formattedNumber = `NM ${nextNumber.toString().padStart(4, "0")}`
    lastBillNumberRef.current = formattedNumber
    return formattedNumber
  }, [])

  useEffect(() => {
    fetchProducts()
    fetchLastBillNumber()
  }, [fetchProducts, fetchLastBillNumber])

  const addToCart = useCallback((product: Product) => {
    const existingItem = cart.find((item) => item.product.id === product.id)

    if (existingItem) {
      if (existingItem.quantity < product.stock_quantity) {
        updateQuantity(product.id, existingItem.quantity + 1)
      }
    } else {
      const newItem: CartItem = {
        product,
        quantity: 1,
        total: product.selling_price || product.price, // Use selling_price if available, fallback to price
      }
      setCart(prev => [...prev, newItem])
    }
  }, [cart])

  const updateQuantity = useCallback((productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId)
      return
    }

    setCart(prev => prev.map((item) => {
      if (item.product.id === productId) {
        return {
          ...item,
          quantity: newQuantity,
          total: (item.product.selling_price || item.product.price) * newQuantity,
        }
      }
      return item
    }))
  }, [])

  const removeFromCart = useCallback((productId: string) => {
    setCart(prev => prev.filter((item) => item.product.id !== productId))
  }, [])

  const handleLoyaltyApplied = useCallback((pointsRedeemed: number, discountAmount: number) => {
    setLoyaltyPointsRedeemed(pointsRedeemed)
    setLoyaltyDiscountAmount(discountAmount)
  }, [])

  const handleDiscountChange = useCallback((amount: number, percentage: number) => {
    setDiscountAmount(amount)
    setDiscountPercentage(percentage)
  }, [])

  const processPayment = useCallback(async () => {
    if (cart.length === 0) return

    if (paymentMethod === "cash" && Number.parseFloat(cashReceived || "0") < roundedTotal) {
      toast.error("Insufficient cash received")
      return
    }

    if (paymentMethod === "credit" && !selectedCustomer) {
      toast.error("Credit payment requires a customer to be selected")
      return
    }

    if (!profile?.id) {
      toast.error("Please log in to process payments")
      return
    }

    setLoading(true)

    try {
      const invoiceNumber = getNextBillNumber()

      // ── Build transaction record ────────────────────────────────
      const transactionData = {
        invoice_number: invoiceNumber,
        cashier_id: profile.id,
        customer_id: selectedCustomer?.id || null,
        customer_name: selectedCustomer?.name || null,
        customer_phone: selectedCustomer?.phone || null,
        subtotal,
        gst_amount: gstAmount,
        total_amount: roundedTotal,
        rounding_adjustment: roundingAdjustment,
        discount_amount: discountAmount,
        discount_percentage: discountPercentage,
        total_savings: discountAmount + loyaltyDiscountAmount,
        loyalty_points_earned: loyaltyPointsEarned,
        loyalty_points_redeemed: loyaltyPointsRedeemed,
        loyalty_discount_amount: loyaltyDiscountAmount,
        payment_method: paymentMethod,
        cash_received: paymentMethod === "cash" ? Number.parseFloat(cashReceived) : null,
        change_amount: paymentMethod === "cash" ? changeAmount : null,
        status: "completed" as const,
      }

      // ── Insert transaction ──────────────────────────────────────
      const { data: transaction, error: transactionError } = await supabase
        .from("transactions")
        .insert(transactionData)
        .select()
        .single()

      if (transactionError) {
        if (transactionError.message?.includes("materialized view")) {
          toast.error("Database configuration error. Please contact support.")
        } else if (transactionError.message?.includes("column")) {
          toast.error("Database schema error. Please contact support.")
        } else {
          toast.error(`Payment failed: ${transactionError.message || "Unknown error"}`)
        }
        return
      }

      // ── Insert transaction items ────────────────────────────────
      const transactionItems = cart.map((item) => ({
        transaction_id: transaction.id,
        product_id: item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
        unit_price: item.product.selling_price || item.product.price,
        total_price: item.total,
        gst_rate: item.product.gst_rate,
        price_includes_gst: item.product.price_includes_gst,
        cost_price: item.product.cost_price,
        mrp: item.product.mrp,
        selling_price: item.product.selling_price || item.product.price,
      }))

      const { error: itemsError } = await supabase
        .from("transaction_items")
        .insert(transactionItems)

      if (itemsError) {
        if (itemsError.code === "23505") {
          toast.error("Duplicate transaction. Please try again.")
        } else if (itemsError.code === "23503") {
          toast.error("Product not found. Please refresh and try again.")
        } else {
          toast.error(`Items save failed: ${itemsError.message || "Unknown error"}`)
        }
        return
      }

      // ── Parallel stock updates ──────────────────────────────────
      const stockUpdateResults = await Promise.all(
        cart.map((item) =>
          supabase
            .from("products")
            .update({ stock_quantity: Math.max(0, item.product.stock_quantity - item.quantity) })
            .eq("id", item.product.id)
        )
      )
      const stockError = stockUpdateResults.find((r) => r.error)?.error
      if (stockError) {
        // Non-fatal: transaction already saved, just warn
        toast.warning("Stock update had an issue. Please check inventory.")
      }

      // ── Update customer loyalty & credit ──────────────────────────
      if (selectedCustomer) {
        const newLoyaltyPoints = Math.max(
          0,
          selectedCustomer.loyalty_points + loyaltyPointsEarned - loyaltyPointsRedeemed
        )
        const newTotalSpent = selectedCustomer.total_spent + roundedTotal
        const newOutstandingCredit = paymentMethod === "credit"
          ? (selectedCustomer.outstanding_credit || 0) + roundedTotal
          : (selectedCustomer.outstanding_credit || 0)

        await supabase
          .from("customers")
          .update({
            loyalty_points: newLoyaltyPoints,
            total_spent: newTotalSpent,
            outstanding_credit: newOutstandingCredit,
          })
          .eq("id", selectedCustomer.id)

        // Record credit sale in credit_ledger
        if (paymentMethod === "credit") {
          try {
            await supabase.from("credit_ledger").insert({
              customer_id: selectedCustomer.id,
              transaction_id: transaction.id,
              amount: roundedTotal,
              entry_type: "credit_sale",
              notes: `Invoice ${transaction.invoice_number}`,
              created_by: profile.id,
            })
          } catch {
            // non-fatal — credit_ledger may not exist yet (run SQL migration)
          }
        }

        // Record loyalty transaction (non-fatal if table missing)
        if (loyaltyPointsEarned > 0 || loyaltyPointsRedeemed > 0) {
          try {
            await supabase.from("loyalty_transactions").insert({
              customer_id: selectedCustomer.id,
              transaction_id: transaction.id,
              points_earned: loyaltyPointsEarned,
              points_redeemed: loyaltyPointsRedeemed,
              discount_amount: loyaltyDiscountAmount,
              transaction_type: loyaltyPointsEarned > 0 ? "earned" : "redeemed",
            })
          } catch {
            // Silently ignore — loyalty table may not exist in all DB setups
          }
        }
      }

      // ── Show receipt ────────────────────────────────────────────
      const receiptTransaction = {
        ...transaction,
        items: cart,
        customer: selectedCustomer,
        cashier: profile,
        loyalty_points_earned: selectedCustomer ? loyaltyPointsEarned : 0,
        loyalty_points_redeemed: loyaltyPointsRedeemed,
        loyalty_discount_amount: loyaltyDiscountAmount,
      }

      // Reset state
      setCart([])
      setCashReceived("")
      setSelectedCustomer(null)
      setLoyaltyPointsRedeemed(0)
      setLoyaltyDiscountAmount(0)
      setDiscountAmount(0)
      setDiscountPercentage(0)

      setLastTransaction(receiptTransaction)
      setShowReceipt(true)

      fetchProducts()
    } catch (error: any) {
      toast.error(
        error?.message
          ? `Payment failed: ${error.message}`
          : "Payment processing failed. Please try again."
      )
    } finally {
      setLoading(false)
    }
  }, [
    cart,
    paymentMethod,
    cashReceived,
    roundedTotal,
    profile,
    selectedCustomer,
    subtotal,
    gstAmount,
    roundingAdjustment,
    discountAmount,
    discountPercentage,
    loyaltyPointsEarned,
    loyaltyPointsRedeemed,
    loyaltyDiscountAmount,
    changeAmount,
    getNextBillNumber,
    fetchProducts,
  ])

  const clearCart = useCallback(() => {
    setCart([])
    setCashReceived("")
    setLoyaltyPointsRedeemed(0)
    setLoyaltyDiscountAmount(0)
    setDiscountAmount(0)
    setDiscountPercentage(0)
  }, [])

  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount)
  }, [])

  // Barcode scanner functionality
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Check if we're in a text input
      const activeElement = document.activeElement as HTMLElement
      if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA') {
        return
      }

      // If Enter is pressed and we're not scanning, treat as barcode
      if (event.key === 'Enter' && !isScanning) {
        setIsScanning(true)
        setTimeout(() => setIsScanning(false), 1000) // Reset after 1 second
        
        // Focus the barcode input
        if (barcodeInputRef.current) {
          barcodeInputRef.current.focus()
        }
      }
    }

    window.addEventListener('keypress', handleKeyPress)
    return () => window.removeEventListener('keypress', handleKeyPress)
  }, [isScanning])

  const handleBarcodeScan = (barcode: string) => {
    // Find product by barcode
    const product = products.find(p => p.barcode === barcode)
    
    if (product) {
      // Add to cart
      addToCart(product)
      toast.success(`Added ${product.name} to cart`)
    } else {
      toast.error(`Product with barcode ${barcode} not found`)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full p-6">
      {/* Products Section */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Products</CardTitle>
            {/* Search and Filter */}
            <div className="space-y-3">
              {/* Combined Search Input */}
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    ref={barcodeInputRef}
                    placeholder="Search products or scan barcode..."
                    value={searchTerm}
                    onChange={(e) => {
                      const value = e.target.value
                      setSearchTerm(value)
                      
                      // Auto-detect barcode scan (if it ends with Enter)
                      if (value.endsWith('\n') || value.endsWith('\r')) {
                        const barcode = value.trim()
                        handleBarcodeScan(barcode)
                        setSearchTerm('') // Clear search after scan
                        e.target.value = '' // Remove the Enter character
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const barcode = e.currentTarget.value.trim()
                        if (barcode) {
                          handleBarcodeScan(barcode)
                          setSearchTerm('')
                          e.currentTarget.value = ''
                        }
                      }
                    }}
                    className="pl-10"
                  />
                  {searchTerm && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSearchTerm("")}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                    >
                      ×
                    </Button>
                  )}
                </div>
                <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Brands" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Brands</SelectItem>
                    {brands.map((brand) => (
                      <SelectItem key={brand} value={brand}>
                        {brand}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-between items-center text-sm text-muted-foreground">
                <span>{filteredProducts.length} products found</span>
                {selectedBrand !== "all" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedBrand("all")}
                  >
                    Clear Brand Filter
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {productsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {[...Array(6)].map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-3">
                      <div className="space-y-2">
                        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                        <div className="h-6 bg-gray-200 rounded animate-pulse"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredProducts.map((product) => {
                  const price = product.selling_price || product.price
                  const cartItem = cart.find(i => i.product.id === product.id)
                  return (
                    <Card
                      key={product.id}
                      className={`cursor-pointer transition-all hover:shadow-lg hover:border-violet-500/40 relative ${cartItem ? 'border-violet-500/60 bg-violet-500/5' : ''}`}
                      onClick={() => addToCart(product)}
                    >
                      {cartItem && (
                        <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center shadow-lg z-10">
                          {cartItem.quantity}
                        </span>
                      )}
                      <CardContent className="p-3">
                        <p className="text-sm font-semibold line-clamp-2 leading-tight mb-2">{product.name}</p>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-base font-bold text-emerald-400">₹{price.toFixed(0)}</span>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                            {product.stock_quantity}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cart Section */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              Shopping Cart
              {cart.length > 0 && (
                <Button variant="outline" size="sm" onClick={clearCart}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Customer Selection */}
            <CustomerSelector selectedCustomer={selectedCustomer} onCustomerSelect={setSelectedCustomer} />

            <Separator />

            {/* Cart Items */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {cart.length === 0 ? (
                <p className="text-center text-gray-500 py-4">Cart is empty</p>
              ) : (
                cart.map((item) => {
                  let itemTotal = 0
                  let priceDisplay = ""
                  
                  const sellingPrice = item.product.selling_price || item.product.price
                  if (item.product.price_includes_gst) {
                    itemTotal = sellingPrice * item.quantity
                    priceDisplay = `${formatCurrency(sellingPrice)} (incl. ${item.product.gst_rate}% GST)`
                  } else {
                    const gstAmount = (sellingPrice * item.product.gst_rate) / 100
                    itemTotal = (sellingPrice + gstAmount) * item.quantity
                    priceDisplay = `${formatCurrency(sellingPrice)} + ${item.product.gst_rate}% GST`
                  }
                  
                  return (
                    <div
                      key={item.product.id}
                      className="flex items-center justify-between p-2 border rounded transition-all hover:bg-muted/50"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.product.name}</p>
                        <p className="text-xs text-gray-500">{item.product.brand} • HSN: {item.product.hsn_code}</p>
                        <p className="text-xs text-gray-400">{priceDisplay}</p>
                        <p className="text-xs text-gray-400">Qty: {item.quantity} × {formatCurrency(item.product.selling_price || item.product.price)}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button size="sm" variant="outline" onClick={() => updateQuantity(item.product.id, item.quantity - 1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm font-medium w-8 text-center">{item.quantity}</span>
                        <Button size="sm" variant="outline" onClick={() => updateQuantity(item.product.id, item.quantity + 1)} disabled={item.quantity >= item.product.stock_quantity}>
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => removeFromCart(item.product.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <Separator />

            {/* Totals */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>GST:</span>
                <span>{formatCurrency(gstAmount)}</span>
              </div>
              {loyaltyDiscountAmount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Loyalty Discount:</span>
                  <span>-₹{loyaltyDiscountAmount.toFixed(2)}</span>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount ({discountPercentage.toFixed(2)}%):</span>
                  <span>-₹{discountAmount.toFixed(2)}</span>
                </div>
              )}
              {roundingAdjustment !== 0 && (
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Rounding:</span>
                  <span>{formatCurrency(roundingAdjustment)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span>{formatCurrency(roundedTotal)}</span>
              </div>
              {calculateTotalSavings() > 0 && (
                <div className="flex justify-between text-sm text-green-600 font-semibold">
                  <span>Total Savings:</span>
                  <span>₹{calculateTotalSavings().toFixed(2)}</span>
                </div>
              )}
              {selectedCustomer && loyaltyPointsEarned > 0 && (
                <div className="flex justify-between text-sm text-purple-600">
                  <span>Loyalty Points:</span>
                  <span>+{loyaltyPointsEarned} pts</span>
                </div>
              )}
            </div>

            <Separator />

            {/* Loyalty Redemption */}
            {selectedCustomer && (
              <LoyaltyRedemption
                customer={selectedCustomer}
                totalAmount={total}
                onLoyaltyApplied={handleLoyaltyApplied}
                loyaltyPointsRedeemed={loyaltyPointsRedeemed}
                loyaltyDiscountAmount={loyaltyDiscountAmount}
              />
            )}

            <Separator />

            {/* Discount Manager */}
            <DiscountManager
              subtotal={total}
              onDiscountChange={handleDiscountChange}
              discountAmount={discountAmount}
              discountPercentage={discountPercentage}
            />

            <Separator />

            {/* Payment Method */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Payment Method:</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={paymentMethod === "cash" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPaymentMethod("cash")}
                >
                  <Banknote className="h-4 w-4 mr-1" />
                  Cash
                </Button>
                <Button
                  variant={paymentMethod === "card" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPaymentMethod("card")}
                >
                  <CreditCard className="h-4 w-4 mr-1" />
                  Card
                </Button>
                <Button
                  variant={paymentMethod === "upi" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPaymentMethod("upi")}
                >
                  <Smartphone className="h-4 w-4 mr-1" />
                  UPI
                </Button>
                <Button
                  variant={paymentMethod === "credit" ? "default" : "outline"}
                  size="sm"
                  disabled={!selectedCustomer}
                  onClick={() => setPaymentMethod("credit")}
                  className={
                    paymentMethod === "credit"
                      ? "bg-orange-600 hover:bg-orange-700 border-orange-600"
                      : !selectedCustomer
                      ? "opacity-50 cursor-not-allowed"
                      : "border-orange-400 text-orange-700 hover:bg-orange-50"
                  }
                  title={!selectedCustomer ? "Select a customer to enable credit payment" : ""}
                >
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  Credit
                </Button>
              </div>

              {/* Credit warning banner */}
              {paymentMethod === "credit" && selectedCustomer && (
                <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 rounded-lg p-2 text-xs text-orange-700 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    <strong>{selectedCustomer.name}</strong> will owe{" "}
                    <strong>₹{roundedTotal.toFixed(2)}</strong> as credit. Current outstanding:{" "}
                    ₹{((selectedCustomer as any).outstanding_credit || 0).toFixed(2)}
                  </span>
                </div>
              )}

              {!selectedCustomer && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-orange-400" />
                  Select a customer to enable Credit payment
                </p>
              )}

              {paymentMethod === "cash" && (
                <div className="space-y-2">
                  <Input
                    type="number"
                    placeholder="Cash Received"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    className="text-lg font-medium"
                  />
                  {cashReceived && Number.parseFloat(cashReceived) >= roundedTotal && (
                    <div className="text-sm bg-green-50 dark:bg-green-950/20 p-2 rounded">
                      <span className="font-medium">Change: </span>
                      <span className="text-green-600 font-bold text-lg">{formatCurrency(changeAmount)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Button
              className={`w-full text-lg py-6 ${
                paymentMethod === "credit"
                  ? "bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700"
                  : "bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
              }`}
              onClick={processPayment}
              disabled={
                cart.length === 0 ||
                loading ||
                (paymentMethod === "cash" && Number.parseFloat(cashReceived || "0") < roundedTotal) ||
                (paymentMethod === "credit" && !selectedCustomer)
              }
            >
              {loading ? (
                "Processing..."
              ) : paymentMethod === "credit" ? (
                <>
                  <AlertTriangle className="h-5 w-5 mr-2" />
                  Bill on Credit — {formatCurrency(roundedTotal)}
                </>
              ) : (
                <>
                  <Receipt className="h-5 w-5 mr-2" />
                  Pay {formatCurrency(roundedTotal)}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Receipt Dialog */}
      {showReceipt && lastTransaction && (
        <ReceiptPreview transaction={lastTransaction} onClose={() => setShowReceipt(false)} />
      )}
    </div>
  )
}
