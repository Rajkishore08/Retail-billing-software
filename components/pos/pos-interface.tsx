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
import { Search, Plus, Minus, Trash2, CreditCard, Smartphone, Banknote, Receipt, Tag } from "lucide-react"
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
}

type PaymentMethod = "cash" | "card" | "upi"

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
      console.log("Fetching products...")
      
      // Use optimized query with caching
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .gt('stock_quantity', 0)
        .order('name')
        .abortSignal(new AbortController().signal) // Add abort signal for better performance

      if (error) {
        console.error("Error fetching products:", error)
        return
      }

      console.log("Products fetched successfully:", data?.length || 0)
      setProducts(data || [])
      
      // Extract unique brands
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
      console.log("Fetching last bill number...")
      const { data, error } = await supabase.rpc('get_last_bill_number')

      if (error) {
        console.error("Error fetching last bill number:", error)
        // Fallback to direct query if RPC fails
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('transactions')
          .select('invoice_number')
          .like('invoice_number', 'NM %')
          .order('invoice_number', { ascending: false })
          .limit(1)
          .single()
        
        if (fallbackError) {
          console.error("Fallback query also failed:", fallbackError)
          lastBillNumberRef.current = 'NM 0000'
          return
        }
        
        if (fallbackData?.invoice_number) {
          lastBillNumberRef.current = fallbackData.invoice_number
        }
        return
      }

      if (data) {
        console.log("Last bill number fetched:", data)
        lastBillNumberRef.current = data
      }
    } catch (error) {
      console.error("Error in fetchLastBillNumber:", error)
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

    if (!profile?.id) {
      toast.error("Please log in to process payments")
      return
    }

    setLoading(true)

    try {
      // Generate invoice number
      const invoiceNumber = getNextBillNumber()

      // Check if database is properly set up
      console.log("Checking database setup...")
      const { data: dbCheck, error: dbCheckError } = await supabase
        .from('products')
        .select('hsn_code, brand, price_includes_gst')
        .limit(1)
      
      if (dbCheckError) {
        console.error("Database setup check failed:", dbCheckError)
        toast.error("Database not properly configured. Please run the database setup script.")
        return
      }
      
      console.log("Database setup check passed:", dbCheck)

      // Debug logging
      console.log("Processing payment with data:", {
        invoiceNumber,
        profile: profile?.id,
        selectedCustomer: selectedCustomer?.id,
        subtotal,
        gstAmount,
        roundedTotal,
        paymentMethod,
        cartLength: cart.length
      })

      // Create transaction
      const transactionData = {
        invoice_number: invoiceNumber,
        cashier_id: profile?.id,
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

      console.log("Transaction data:", transactionData)

      console.log("Attempting to insert transaction...")
      const { data: transaction, error: transactionError } = await supabase
        .from("transactions")
        .insert(transactionData)
        .select()
        .single()

      if (transactionError) {
        console.error("Transaction insert error:", transactionError)
        console.error("Transaction data that failed:", transactionData)
        
        // Check if it's a materialized view error
        if (transactionError.message && transactionError.message.includes('materialized view')) {
          toast.error("Database configuration error. Please run the database fix script.")
          return
        }
        
        // Check if it's a column error
        if (transactionError.message && transactionError.message.includes('column')) {
          toast.error("Database schema error. Please run the database setup script.")
          return
        }
        
        throw transactionError
      }
      
      console.log("Transaction created successfully:", transaction)

      // Create transaction items
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

      console.log("Creating transaction items:", transactionItems)
      
      const { error: itemsError } = await supabase.from("transaction_items").insert(transactionItems)

      if (itemsError) {
        console.error("Transaction items insert error:", itemsError)
        console.error("Error details:", {
          message: itemsError.message,
          code: itemsError.code,
          details: itemsError.details,
          hint: itemsError.hint
        })
        
        // Show specific error message to user
        if (itemsError.code === '23505') {
          toast.error("Duplicate transaction detected. Please try again.")
        } else if (itemsError.code === '23503') {
          toast.error("Product not found. Please refresh and try again.")
        } else {
          toast.error(`Transaction failed: ${itemsError.message || 'Unknown error'}`)
        }
        
        throw itemsError
      }
      
            console.log("Transaction items created successfully")
      
      // If we get here, the database is working correctly
      console.log("✅ Database operations are working correctly")
      
      // Update stock quantities
      console.log("Updating stock quantities...")
      for (const item of cart) {
        console.log(`Updating stock for ${item.product.name}: ${item.product.stock_quantity} - ${item.quantity}`)
        const { error: stockError } = await supabase
          .from("products")
          .update({
            stock_quantity: item.product.stock_quantity - item.quantity,
          })
          .eq("id", item.product.id)

        if (stockError) {
          console.error("Stock update error:", stockError)
          throw stockError
        }
      }
      
      console.log("Stock quantities updated successfully")

      // Update customer loyalty points
      if (selectedCustomer) {
        console.log("Updating customer loyalty points...")
        const newLoyaltyPoints = selectedCustomer.loyalty_points + loyaltyPointsEarned - loyaltyPointsRedeemed
        const newTotalSpent = selectedCustomer.total_spent + roundedTotal

        console.log(`Customer loyalty update: ${selectedCustomer.loyalty_points} + ${loyaltyPointsEarned} - ${loyaltyPointsRedeemed} = ${newLoyaltyPoints}`)

        const { error: customerUpdateError } = await supabase
          .from("customers")
          .update({
            loyalty_points: newLoyaltyPoints,
            total_spent: newTotalSpent,
          })
          .eq("id", selectedCustomer.id)

        if (customerUpdateError) {
          console.error("Customer update error:", customerUpdateError)
          throw customerUpdateError
        }

        // Create loyalty transaction records
        if (loyaltyPointsEarned > 0 || loyaltyPointsRedeemed > 0) {
          console.log("Creating loyalty transaction record...")
          const loyaltyTransactionData = {
            customer_id: selectedCustomer.id,
            transaction_id: transaction.id,
            points_earned: loyaltyPointsEarned,
            points_redeemed: loyaltyPointsRedeemed,
            discount_amount: loyaltyDiscountAmount,
            transaction_type: loyaltyPointsEarned > 0 ? 'earned' : 'redeemed'
          }

          try {
            const { error: loyaltyError } = await supabase.from("loyalty_transactions").insert(loyaltyTransactionData)
            
            if (loyaltyError) {
              console.error("Loyalty transaction error:", loyaltyError)
              console.error("Loyalty error details:", {
                message: loyaltyError.message,
                code: loyaltyError.code,
                details: loyaltyError.details,
                hint: loyaltyError.hint
              })
              
              // Show specific loyalty error message
              if (loyaltyError.code === '23503') {
                toast.error("Customer or transaction not found. Please try again.")
              } else if (loyaltyError.message) {
                toast.error(`Loyalty transaction failed: ${loyaltyError.message}`)
              } else {
                toast.error("Loyalty transaction failed. Please try again.")
              }
              
              throw loyaltyError
            }
            
            console.log("Loyalty transaction created successfully")
          } catch (loyaltyError: any) {
            console.error("Loyalty transaction failed:", loyaltyError)
            // Continue with the transaction even if loyalty record fails
            console.log("Continuing with transaction despite loyalty error...")
            toast.warning("Transaction completed but loyalty record failed. Please check database setup.")
          }
        }
      }

      // Prepare transaction data for receipt
      const receiptTransaction = {
        ...transaction,
        items: cart,
        customer: selectedCustomer,
        cashier: profile,
        loyalty_points_earned: selectedCustomer ? loyaltyPointsEarned : 0,
        loyalty_points_redeemed: loyaltyPointsRedeemed,
        loyalty_discount_amount: loyaltyDiscountAmount,
      }

      // Clear cart and show success
      setCart([])
      setCashReceived("")
      setSelectedCustomer(null)
      setLoyaltyPointsRedeemed(0)
      setLoyaltyDiscountAmount(0)
      setDiscountAmount(0)
      setDiscountPercentage(0)

      // Show receipt
      setLastTransaction(receiptTransaction)
      setShowReceipt(true)

      // Refresh products to update stock
      fetchProducts()
    } catch (error: any) {
      console.error("Error processing payment:", error)
      console.error("Error details:", {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        stack: error?.stack
      })
      // Show specific error message to user
      if (error?.code === '23505') {
        toast.error("Duplicate transaction detected. Please try again.")
      } else if (error?.code === '23503') {
        toast.error("Product not found. Please refresh and try again.")
      } else if (error?.message) {
        toast.error(`Payment failed: ${error.message}`)
      } else {
        toast.error("Payment processing failed. Please try again.")
      }
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
    loyaltyPointsEarned, 
    loyaltyPointsRedeemed, 
    loyaltyDiscountAmount, 
    changeAmount, 
    getNextBillNumber, 
    fetchProducts
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
                {filteredProducts.map((product) => (
                  <Card
                    key={product.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => addToCart(product)}
                  >
                    <CardContent className="p-3">
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <h3 className="font-medium text-sm line-clamp-2">{product.name}</h3>
                          <p className="text-xs text-muted-foreground">{product.brand}</p>
                        </div>
                        
                        <div className="flex justify-between items-center mb-1">
                          <div className="flex flex-col">
                            <span className="text-lg font-bold text-green-600">{formatCurrency(product.selling_price || product.price)}</span>
                            {product.mrp && product.mrp > (product.selling_price || product.price) && (
                              <div className="flex items-center space-x-1">
                                <span className="text-xs text-gray-500 line-through">MRP: {formatCurrency(product.mrp)}</span>
                                <Badge variant="outline" className="text-xs text-green-600">
                                  Save {formatCurrency(product.mrp - (product.selling_price || product.price))}
                                </Badge>
                              </div>
                            )}
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            Stock: {product.stock_quantity}
                          </Badge>
                        </div>
                        
                        <div className="text-xs text-gray-500 space-y-1">
                          <div className="flex justify-between">
                            <span>HSN:</span>
                            <span className="font-mono">{product.hsn_code}</span>
                          </div>
                          {product.price_includes_gst ? (
                            <span className="text-green-600">✓ Price includes {product.gst_rate}% GST</span>
                          ) : (
                            <span className="text-orange-600">+ {product.gst_rate}% GST will be added</span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
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
              <div className="grid grid-cols-3 gap-2">
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
              </div>

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
              className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-lg py-6"
              onClick={processPayment}
              disabled={
                cart.length === 0 ||
                loading ||
                (paymentMethod === "cash" && Number.parseFloat(cashReceived || "0") < roundedTotal)
              }
            >
              {loading ? (
                "Processing..."
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
