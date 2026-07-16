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
import { Search, Plus, Minus, Trash2, CreditCard, Smartphone, Banknote, Receipt, Tag, AlertTriangle, Barcode, Layers, Scan, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { getAllProductImages, placeholderClass, initials } from "@/lib/product-image-store"
import { getStoreQrImage } from "@/lib/store-image-store"

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
  sale_unit?: string
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
  const [debouncedSearch, setDebouncedSearch] = useState("")

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 300)
    return () => clearTimeout(handler)
  }, [searchTerm])

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

  // Save/load draft state
  const [draftLoaded, setDraftLoaded] = useState(false)

  // Load draft on mount
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem("pos_bill_draft")
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft)
        if (parsed.cart && Array.isArray(parsed.cart)) setCart(parsed.cart)
        if (parsed.selectedCustomer) setSelectedCustomer(parsed.selectedCustomer)
        if (parsed.paymentMethod) setPaymentMethod(parsed.paymentMethod)
        if (parsed.cashReceived !== undefined) setCashReceived(parsed.cashReceived)
        if (parsed.loyaltyPointsRedeemed !== undefined) setLoyaltyPointsRedeemed(parsed.loyaltyPointsRedeemed)
        if (parsed.loyaltyDiscountAmount !== undefined) setLoyaltyDiscountAmount(parsed.loyaltyDiscountAmount)
        if (parsed.discountAmount !== undefined) setDiscountAmount(parsed.discountAmount)
        if (parsed.discountPercentage !== undefined) setDiscountPercentage(parsed.discountPercentage)
      }
    } catch (e) {
      console.error("Failed to parse saved POS bill draft", e)
    } finally {
      setDraftLoaded(true)
    }
  }, [])

  // Save bill draft to localStorage
  useEffect(() => {
    if (!draftLoaded) return
    try {
      const billState = {
        cart,
        selectedCustomer,
        paymentMethod,
        cashReceived,
        loyaltyPointsRedeemed,
        loyaltyDiscountAmount,
        discountAmount,
        discountPercentage,
      }
      localStorage.setItem("pos_bill_draft", JSON.stringify(billState))
    } catch (e) {
      console.error("Failed to save POS bill draft", e)
    }
  }, [
    draftLoaded,
    cart,
    selectedCustomer,
    paymentMethod,
    cashReceived,
    loyaltyPointsRedeemed,
    loyaltyDiscountAmount,
    discountAmount,
    discountPercentage,
  ])

  // Barcode scanner state
  const [isScanning, setIsScanning] = useState(false)
  const barcodeInputRef = useRef<HTMLInputElement>(null)

  // Add product dialog state
  const [showAddProductDialog, setShowAddProductDialog] = useState(false)
  const [storeSettings, setStoreSettings] = useState<Record<string, string>>({})
  const [activeUpiCounterId, setActiveUpiCounterId] = useState<string>("")

  // Find list of counters from settings
  const upiCounters = useMemo(() => {
    if (storeSettings.upi_ids) {
      try {
        return JSON.parse(storeSettings.upi_ids) as { id: string; label: string; upi: string; isDefault: boolean }[]
      } catch {}
    }
    if (storeSettings.upi_id) {
      return [{ id: "legacy-default", label: "Default Counter", upi: storeSettings.upi_id, isDefault: true }]
    }
    return []
  }, [storeSettings])

  // Select active UPI Counter
  const activeUpiCounter = useMemo(() => {
    if (upiCounters.length === 0) return null
    return upiCounters.find(u => u.id === activeUpiCounterId) || upiCounters.find(u => u.isDefault) || upiCounters[0] || null
  }, [upiCounters, activeUpiCounterId])

  // Sticky counter selection on this device/browser
  useEffect(() => {
    if (upiCounters.length > 0 && !activeUpiCounterId) {
      try {
        const savedId = localStorage.getItem("pos_active_upi_counter_id")
        const defaultCounter = upiCounters.find(u => u.isDefault) || upiCounters[0]
        const initialId = (savedId && upiCounters.some(u => u.id === savedId)) ? savedId : defaultCounter.id
        setActiveUpiCounterId(initialId)
      } catch {}
    }
  }, [upiCounters, activeUpiCounterId])

  const [productImages, setProductImages] = useState<Record<string, string>>({})
  const [newProductForm, setNewProductForm] = useState({
    name: "",
    price: "",
    cost_price: "",
    selling_price: "",
    stock_quantity: "",
    min_stock_level: "5",
    gst_rate: "18",
    price_includes_gst: true,
    hsn_code: "",
    brand: "",
    barcode: "",
    sale_unit: "pcs",
  })

  const handleAddNewProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const data = {
      name: newProductForm.name,
      price: parseFloat(newProductForm.price),
      cost_price: newProductForm.cost_price ? parseFloat(newProductForm.cost_price) : null,
      mrp: parseFloat(newProductForm.price),
      selling_price: newProductForm.selling_price ? parseFloat(newProductForm.selling_price) : parseFloat(newProductForm.price),
      stock_quantity: parseFloat(newProductForm.stock_quantity),
      min_stock_level: parseFloat(newProductForm.min_stock_level),
      gst_rate: parseFloat(newProductForm.gst_rate),
      price_includes_gst: newProductForm.price_includes_gst,
      hsn_code: newProductForm.hsn_code || "999999",
      brand: newProductForm.brand || "Generic",
      barcode: newProductForm.barcode || null,
      sale_unit: newProductForm.sale_unit,
    }

    try {
      const { data: dup } = await supabase.from("products").select("id,name").eq("name", newProductForm.name).single()
      if (dup) { toast.error(`"${newProductForm.name}" already exists`); return }
      if (newProductForm.barcode) {
        const { data: dupB } = await supabase.from("products").select("id,name").eq("barcode", newProductForm.barcode).single()
        if (dupB) { toast.error(`Barcode already used by "${dupB.name}"`); return }
      }

      const { data: inserted, error } = await supabase.from("products").insert(data).select("id").single()
      if (error) { toast.error(`Failed to add product: ${error.message}`); return }

      toast.success("Product added successfully!")
      setShowAddProductDialog(false)
      setNewProductForm({
        name: "",
        price: "",
        cost_price: "",
        selling_price: "",
        stock_quantity: "",
        min_stock_level: "5",
        gst_rate: "18",
        price_includes_gst: true,
        hsn_code: "",
        brand: "",
        barcode: "",
        sale_unit: "pcs",
      })
      fetchProducts()
    } catch (err: any) {
      toast.error(`Error: ${err?.message || "Unknown"}`)
    }
  }

  // Memoized filtered products for better performance
  const filteredProducts = useMemo(() => {
    let filtered = products
    
    // Filter by brand
    if (selectedBrand !== "all") {
      filtered = filtered.filter(product => product.brand === selectedBrand)
    }
    
    // Filter by search term (combined product search and barcode)
    if (debouncedSearch.trim()) {
      const searchLower = debouncedSearch.toLowerCase()
      filtered = filtered.filter(
        (product) => 
          product.name.toLowerCase().includes(searchLower) || 
          product.barcode?.includes(searchLower) ||
          product.brand.toLowerCase().includes(searchLower) ||
          product.hsn_code.includes(searchLower)
      )
    }
    
    return filtered
  }, [products, debouncedSearch, selectedBrand])

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

  const fetchStoreSettings = useCallback(async () => {
    try {
      const { data } = await supabase.from("settings").select("key, value")
      if (data) {
        const settings = data.reduce((acc, s) => { acc[s.key] = s.value; return acc }, {} as Record<string, string>)
        setStoreSettings(settings)
      }
    } catch (error) {
      console.error("Error fetching store settings:", error)
    }
  }, [])

  useEffect(() => {
    fetchProducts()
    fetchLastBillNumber()
    fetchStoreSettings()
    setProductImages(getAllProductImages())
  }, [fetchProducts, fetchLastBillNumber, fetchStoreSettings])

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
        upi_id: activeUpiCounter ? activeUpiCounter.upi : storeSettings.upi_id,
      }

      // Reset state
      setCart([])
      setCashReceived("")
      setSelectedCustomer(null)
      setLoyaltyPointsRedeemed(0)
      setLoyaltyDiscountAmount(0)
      setDiscountAmount(0)
      setDiscountPercentage(0)
      try {
        localStorage.removeItem("pos_bill_draft")
      } catch {}

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
    setSelectedCustomer(null)
    setLoyaltyPointsRedeemed(0)
    setLoyaltyDiscountAmount(0)
    setDiscountAmount(0)
    setDiscountPercentage(0)
    try {
      localStorage.removeItem("pos_bill_draft")
    } catch {}
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

  const getUpiQrUrl = () => {
    const upiId = activeUpiCounter ? activeUpiCounter.upi : storeSettings.upi_id
    if (!upiId) return null
    const amount = roundedTotal.toFixed(2)
    const upiString = `upi://pay?pa=${upiId}&am=${amount}&cu=INR`
    return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiString)}`
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full p-6">
      {/* Products Section */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center mb-2">
              <CardTitle>Products</CardTitle>
              <Button onClick={() => setShowAddProductDialog(true)} size="sm" className="gradient-primary text-white border-0 shadow-md">
                <Plus className="h-4 w-4 mr-1" /> Add Product
              </Button>
            </div>
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
                    className="pl-10 pr-24"
                  />
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1.5">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-500 tracking-wider">SCANNER READY</span>
                  </div>
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
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredProducts.map((product) => {
                  const price = product.selling_price || product.price
                  const cartItem = cart.find(i => i.product.id === product.id)
                  const hasMrp = product.mrp && product.mrp > price
                  const discount = hasMrp ? Math.round((1 - price / product.mrp!) * 100) : 0
                  const isLowStock = product.stock_quantity <= 5
                  const imageUrl = productImages[product.id]
                  
                  return (
                    <Card
                      key={product.id}
                      className={`cursor-pointer transition-all duration-200 hover:shadow-md border-border relative overflow-hidden flex flex-col justify-between ${
                        cartItem 
                          ? 'border-blue-500 bg-blue-500/5 dark:bg-blue-950/10 shadow-blue-500/10 shadow-md ring-1 ring-blue-500/30' 
                          : 'hover:border-blue-500/40 bg-card hover:bg-accent/10'
                      }`}
                      onClick={() => addToCart(product)}
                    >
                      <CardContent className="p-3 flex gap-3 h-full">
                        {/* Thumbnail */}
                        <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 border border-border bg-muted flex items-center justify-center relative shadow-inner">
                          {imageUrl ? (
                            <img src={imageUrl} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className={`w-full h-full ${placeholderClass(product.name)} flex items-center justify-center text-white font-bold text-lg`}>
                              {initials(product.name)}
                            </div>
                          )}
                          {discount > 0 && (
                            <span className="absolute bottom-0 left-0 right-0 bg-rose-600 text-white text-[8px] font-bold text-center py-0.5 uppercase tracking-wider">
                              -{discount}%
                            </span>
                          )}
                        </div>

                        {/* Product info */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider truncate">
                                {product.brand || 'Generic'}
                              </span>
                              {isLowStock && (
                                <span className="text-[9px] font-extrabold text-amber-500 flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3 shrink-0" />
                                  <span>LOW STOCK ({product.stock_quantity})</span>
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-bold truncate leading-snug tracking-tight" title={product.name}>
                              {product.name}
                            </p>
                          </div>

                          <div className="flex items-center justify-between gap-1.5 mt-1.5">
                            <div className="flex items-baseline gap-1">
                              <span className="text-sm font-black text-emerald-500 font-numeric">
                                ₹{price.toFixed(0)}
                              </span>
                              {hasMrp && (
                                <span className="text-[10px] text-muted-foreground line-through font-numeric">
                                  ₹{product.mrp!.toFixed(0)}
                                </span>
                              )}
                            </div>

                            {/* Inline Cart Controls */}
                            {cartItem ? (
                              cartItem.product.sale_unit === 'kg' ? (
                                <div className="flex items-center border rounded-lg px-1 bg-background/80 shadow-sm" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="number"
                                    step="0.001"
                                    value={cartItem.quantity}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0
                                      updateQuantity(product.id, val)
                                    }}
                                    className="h-5 w-12 border-0 bg-transparent text-center font-bold text-[10px] focus:outline-none"
                                  />
                                  <span className="text-[9px] font-semibold text-muted-foreground pr-0.5">kg</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 bg-background/80 border border-border rounded-lg p-0.5 shadow-sm" onClick={(e) => e.stopPropagation()}>
                                  <button 
                                    className="h-5 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                                    onClick={() => updateQuantity(product.id, cartItem.quantity - 1)}
                                  >
                                    <Minus className="h-2.5 w-2.5" />
                                  </button>
                                  <span className="text-xs font-bold w-5 text-center font-numeric">{cartItem.quantity}</span>
                                  <button 
                                    className="h-5 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                                    disabled={cartItem.quantity >= product.stock_quantity}
                                    onClick={() => updateQuantity(product.id, cartItem.quantity + 1)}
                                  >
                                    <Plus className="h-2.5 w-2.5" />
                                  </button>
                                </div>
                              )
                            ) : (
                              <span className="text-[9px] text-muted-foreground font-semibold font-numeric">
                                {product.sale_unit === 'kg' ? 'Price/kg' : `HSN: ${product.hsn_code || '9999'}`}
                              </span>
                            )}
                          </div>
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
                        {item.product.sale_unit === 'kg' ? (
                          <div className="flex items-center border rounded-md px-1.5 py-0.5 bg-background">
                            <input
                              type="number"
                              step="0.001"
                              value={item.quantity}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0
                                updateQuantity(item.product.id, val)
                              }}
                              className="h-6 w-16 p-0 border-0 focus:outline-none focus:ring-0 text-center font-bold text-xs"
                            />
                            <span className="text-[10px] font-bold text-muted-foreground pl-1">kg</span>
                          </div>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => updateQuantity(item.product.id, item.quantity - 1)}>
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="text-sm font-medium w-8 text-center">{item.quantity}</span>
                            <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => updateQuantity(item.product.id, item.quantity + 1)} disabled={item.quantity >= item.product.stock_quantity}>
                              <Plus className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="destructive" className="h-7 w-7 p-0" onClick={() => removeFromCart(item.product.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
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
                <div className="flex justify-between text-sm text-blue-600">
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

            {(() => {
              const isUpi = paymentMethod === "upi"
              const upiId = activeUpiCounter ? activeUpiCounter.upi : storeSettings.upi_id
              const showDynamicQr = isUpi && !!upiId
              const uploadedQr = getStoreQrImage()
              const effectiveQr = uploadedQr || null
              const qrImageToDisplay = showDynamicQr ? getUpiQrUrl() : effectiveQr

              if (!qrImageToDisplay) return null

              return (
                <div className="bg-slate-50 dark:bg-slate-900/40 border border-border rounded-xl p-4 text-center space-y-3 shadow-sm animate-fade-in my-3">
                  {isUpi && upiCounters.length > 1 && (
                    <div className="space-y-1 text-left max-w-[240px] mx-auto">
                      <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Select Counter / UPI QR</Label>
                      <select
                        value={activeUpiCounterId}
                        onChange={(e) => {
                          const id = e.target.value
                          setActiveUpiCounterId(id)
                          try { localStorage.setItem("pos_active_upi_counter_id", id) } catch {}
                        }}
                        className="w-full h-8 rounded-lg bg-background border border-border text-xs px-2 focus:outline-none focus:border-emerald-500/50"
                      >
                        {upiCounters.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label} ({c.upi.slice(0, 12)}...)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {showDynamicQr ? "Scan to Pay via UPI" : "Scan QR Code"}
                  </p>
                  <div className="bg-white p-2 rounded-lg inline-block border border-gray-100 shadow-inner">
                    <img
                      src={qrImageToDisplay}
                      alt="Checkout QR"
                      className="w-32 h-32 mx-auto object-contain"
                    />
                  </div>
                  {showDynamicQr && upiId && (
                    <p className="text-xs font-semibold text-foreground font-mono">
                      {upiId}
                    </p>
                  )}
                  {showDynamicQr && (
                    <p className="text-[10px] text-muted-foreground">
                      Amount: <span className="font-bold text-emerald-500">₹{roundedTotal.toFixed(2)}</span>
                    </p>
                  )}
                </div>
              )
            })()}

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

      {/* Add Product Dialog */}
      <Dialog open={showAddProductDialog} onOpenChange={setShowAddProductDialog}>
        <DialogContent className="max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-500" />
              <DialogTitle className="text-lg font-bold">Add New Product</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Add a new product to inventory. It will be instantly available for billing.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddNewProductSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="pos-new-name" className="text-xs font-semibold">Product Name *</Label>
              <Input
                id="pos-new-name"
                value={newProductForm.name}
                onChange={e => setNewProductForm({ ...newProductForm, name: e.target.value })}
                placeholder="e.g. Tata Tea Gold 500g"
                required
                className="h-9 rounded-xl text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pos-new-mrp" className="text-xs font-semibold">MRP / Price (₹) *</Label>
                <Input
                  id="pos-new-mrp"
                  type="number"
                  step="0.01"
                  value={newProductForm.price}
                  onChange={e => setNewProductForm({ ...newProductForm, price: e.target.value })}
                  placeholder="0.00"
                  required
                  className="h-9 rounded-xl text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pos-new-qty" className="text-xs font-semibold">Initial Stock Qty *</Label>
                <Input
                  id="pos-new-qty"
                  type="number"
                  value={newProductForm.stock_quantity}
                  onChange={e => setNewProductForm({ ...newProductForm, stock_quantity: e.target.value })}
                  placeholder="0"
                  required
                  className="h-9 rounded-xl text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pos-new-cost" className="text-xs font-semibold">Cost Price (₹)</Label>
                <Input
                  id="pos-new-cost"
                  type="number"
                  step="0.01"
                  value={newProductForm.cost_price}
                  onChange={e => setNewProductForm({ ...newProductForm, cost_price: e.target.value })}
                  placeholder="0.00"
                  className="h-9 rounded-xl text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pos-new-selling" className="text-xs font-semibold">Selling Price (₹)</Label>
                <Input
                  id="pos-new-selling"
                  type="number"
                  step="0.01"
                  value={newProductForm.selling_price}
                  onChange={e => setNewProductForm({ ...newProductForm, selling_price: e.target.value })}
                  placeholder="0.00"
                  className="h-9 rounded-xl text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="pos-new-brand" className="text-xs font-semibold">Brand</Label>
                <Input
                  id="pos-new-brand"
                  value={newProductForm.brand}
                  onChange={e => setNewProductForm({ ...newProductForm, brand: e.target.value })}
                  placeholder="Generic"
                  className="h-9 rounded-xl text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pos-new-hsn" className="text-xs font-semibold">HSN Code</Label>
                <Input
                  id="pos-new-hsn"
                  value={newProductForm.hsn_code}
                  onChange={e => setNewProductForm({ ...newProductForm, hsn_code: e.target.value })}
                  placeholder="999999"
                  className="h-9 rounded-xl text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pos-new-unit" className="text-xs font-semibold">Sale Unit *</Label>
                <Select
                  value={newProductForm.sale_unit}
                  onValueChange={val => setNewProductForm({ ...newProductForm, sale_unit: val })}
                >
                  <SelectTrigger id="pos-new-unit" className="h-9 rounded-xl text-sm">
                    <SelectValue placeholder="pcs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pcs">Pieces (pcs)</SelectItem>
                    <SelectItem value="kg">Kilograms (kg)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pos-new-gst" className="text-xs font-semibold">GST Rate (%) *</Label>
                <Input
                  id="pos-new-gst"
                  type="number"
                  step="0.01"
                  value={newProductForm.gst_rate}
                  onChange={e => setNewProductForm({ ...newProductForm, gst_rate: e.target.value })}
                  required
                  className="h-9 rounded-xl text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pos-new-min-stock" className="text-xs font-semibold">Min Stock Level *</Label>
                <Input
                  id="pos-new-min-stock"
                  type="number"
                  value={newProductForm.min_stock_level}
                  onChange={e => setNewProductForm({ ...newProductForm, min_stock_level: e.target.value })}
                  required
                  className="h-9 rounded-xl text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pos-new-barcode" className="text-xs font-semibold">Barcode</Label>
              <Input
                id="pos-new-barcode"
                value={newProductForm.barcode}
                onChange={e => setNewProductForm({ ...newProductForm, barcode: e.target.value })}
                placeholder="Scan or enter barcode (optional)"
                className="h-9 rounded-xl text-sm"
              />
            </div>

            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-border cursor-pointer hover:bg-accent/40 transition-colors">
              <input 
                type="checkbox"
                checked={newProductForm.price_includes_gst}
                onChange={e => setNewProductForm({ ...newProductForm, price_includes_gst: e.target.checked })}
                className="w-4 h-4 rounded accent-blue-600" 
              />
              <div className="flex-1">
                <p className="text-xs font-semibold">Price includes GST</p>
              </div>
              {newProductForm.price_includes_gst && (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              )}
            </label>

            <div className="flex gap-2 pt-2 border-t border-border">
              <Button type="submit" className="flex-1 h-10 rounded-xl gradient-primary border-0 font-semibold shadow-md text-white">
                Create Product
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowAddProductDialog(false)} className="flex-1 h-10 rounded-xl font-semibold">
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
