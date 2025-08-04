"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Edit, Trash2, Package, Scan, Search } from "lucide-react"
import { supabase } from "@/lib/supabase-client"
import { toast } from "sonner"

type Product = {
  id: string
  name: string
  price: number
  cost_price?: number
  mrp?: number
  selling_price?: number
  stock_quantity: number
  min_stock_level: number
  gst_rate: number
  price_includes_gst: boolean
  hsn_code: string
  brand: string
  barcode?: string
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    cost_price: "",
    selling_price: "",
    stock_quantity: "",
    min_stock_level: "5",
    gst_rate: "18",
    price_includes_gst: "true",
    hsn_code: "",
    brand: "",
    barcode: "",
  })
  
  // Barcode scanner state
  const [isScanning, setIsScanning] = useState(false)
  const barcodeInputRef = useRef<HTMLInputElement>(null)

  const [brands, setBrands] = useState<string[]>([])
  const [showBrandSuggestions, setShowBrandSuggestions] = useState(false)
  const [filteredBrands, setFilteredBrands] = useState<string[]>([])

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, cost_price, mrp, selling_price, stock_quantity, min_stock_level, gst_rate, price_includes_gst, hsn_code, brand, barcode")
        .order("name")

      if (error) {
        console.error("Error fetching products:", error)
        toast.error("Failed to load products")
        return
      }

      setProducts(data || [])
      setFilteredProducts(data || [])
      
      // Extract unique brands for suggestions
      const uniqueBrands = [...new Set((data || []).map(p => p.brand).filter(b => b && b.trim()))].sort()
      setBrands(uniqueBrands)
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to load products")
    } finally {
      setLoading(false)
    }
  }

  // Filter brands based on input
  const handleBrandInputChange = (value: string) => {
    setFormData(prev => ({ ...prev, brand: value }))
    
    if (value.trim()) {
      const filtered = brands.filter(brand => 
        brand.toLowerCase().includes(value.toLowerCase())
      )
      setFilteredBrands(filtered)
      setShowBrandSuggestions(filtered.length > 0)
    } else {
      setShowBrandSuggestions(false)
    }
  }

  const selectBrand = (brand: string) => {
    setFormData(prev => ({ ...prev, brand }))
    setShowBrandSuggestions(false)
  }

  // Search and filter products
  const filterProducts = useCallback(() => {
    if (!searchTerm.trim()) {
      setFilteredProducts(products)
      return
    }

    const searchLower = searchTerm.toLowerCase()
    const filtered = products.filter(product => 
      product.name.toLowerCase().includes(searchLower) ||
      product.hsn_code.toLowerCase().includes(searchLower) ||
      (product.barcode && product.barcode.toLowerCase().includes(searchLower)) ||
      product.brand.toLowerCase().includes(searchLower)
    )
    setFilteredProducts(filtered)
  }, [searchTerm, products])

  // Update filtered products when search term or products change
  useEffect(() => {
    filterProducts()
  }, [filterProducts])

  useEffect(() => {
    fetchProducts()
  }, [])

  // Barcode scanner functionality
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Check if barcode input is focused
      if (document.activeElement === barcodeInputRef.current) {
        return
      }

      // If Enter is pressed and we're not in a text input, treat as barcode
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
    // Check if product with this barcode already exists
    const existingProduct = products.find(p => p.barcode === barcode)
    
    if (existingProduct) {
      toast.info(`Product found: ${existingProduct.name}`)
      // Optionally auto-fill form with existing product data
      setFormData({
        name: existingProduct.name,
        price: existingProduct.price.toString(),
        cost_price: existingProduct.cost_price?.toString() || "",
        selling_price: existingProduct.selling_price?.toString() || "",
        stock_quantity: existingProduct.stock_quantity.toString(),
        min_stock_level: existingProduct.min_stock_level.toString(),
        gst_rate: existingProduct.gst_rate.toString(),
        price_includes_gst: existingProduct.price_includes_gst ? "true" : "false",
        hsn_code: existingProduct.hsn_code,
        brand: existingProduct.brand,
        barcode: existingProduct.barcode || "",
      })
    } else {
      // New product - just set the barcode
      setFormData(prev => ({ ...prev, barcode }))
      toast.success(`Barcode scanned: ${barcode}`)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const productData = {
      name: formData.name,
      price: Number.parseFloat(formData.price), // This is MRP
      cost_price: formData.cost_price ? Number.parseFloat(formData.cost_price) : null,
      mrp: Number.parseFloat(formData.price), // MRP is the main price field
      selling_price: formData.selling_price ? Number.parseFloat(formData.selling_price) : Number.parseFloat(formData.price), // Default to MRP if not set
      stock_quantity: Number.parseInt(formData.stock_quantity),
      min_stock_level: Number.parseInt(formData.min_stock_level),
      gst_rate: Number.parseFloat(formData.gst_rate),
      price_includes_gst: formData.price_includes_gst === "true",
      hsn_code: formData.hsn_code || "999999",
      brand: formData.brand || "Generic",
      barcode: formData.barcode || null,
    }

    try {
      // Check for duplicate barcode, HSN code, and product name when adding new product
      if (!editingProduct) {
        // Check for duplicate product name
        const { data: existingName, error: nameError } = await supabase
          .from("products")
          .select("id, name")
          .eq("name", formData.name)
          .single()

        if (nameError && nameError.code !== 'PGRST116') { // PGRST116 = no rows returned
          console.error("Name check error:", nameError)
          toast.error(`Error checking product name: ${nameError.message}`)
          return
        }

        if (existingName) {
          toast.error(`Product with name "${formData.name}" already exists`)
          return
        }

        // Check for duplicate barcode
        if (formData.barcode) {
          const { data: existingBarcode, error: barcodeError } = await supabase
            .from("products")
            .select("id, name")
            .eq("barcode", formData.barcode)
            .single()

          if (barcodeError && barcodeError.code !== 'PGRST116') { // PGRST116 = no rows returned
            console.error("Barcode check error:", barcodeError)
            toast.error(`Error checking barcode: ${barcodeError.message}`)
            return
          }

          if (existingBarcode) {
            toast.error(`Product with barcode "${formData.barcode}" already exists: ${existingBarcode.name}`)
            return
          }
        }

        // Check for duplicate HSN code
        const { data: existingHsn, error: hsnError } = await supabase
          .from("products")
          .select("id, name")
          .eq("hsn_code", formData.hsn_code)
          .single()

        if (hsnError && hsnError.code !== 'PGRST116') { // PGRST116 = no rows returned
          console.error("HSN check error:", hsnError)
          toast.error(`Error checking HSN code: ${hsnError.message}`)
          return
        }

        if (existingHsn) {
          toast.error(`Product with HSN code "${formData.hsn_code}" already exists: ${existingHsn.name}`)
          return
        }
      }

      if (editingProduct) {
        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", editingProduct.id)

        if (error) {
          console.error("Error updating product:", error)
          
          // Handle specific constraint errors
          if (error.code === '23505') { // Unique constraint violation
            if (error.message.includes('barcode')) {
              toast.error(`Barcode "${formData.barcode}" already exists in another product`)
            } else if (error.message.includes('hsn_code')) {
              toast.error(`HSN code "${formData.hsn_code}" already exists in another product`)
            } else if (error.message.includes('name')) {
              toast.error(`Product name "${formData.name}" already exists in another product`)
            } else {
              toast.error(`Duplicate entry: ${error.message}`)
            }
          } else {
            toast.error(`Failed to update product: ${error.message}`)
          }
          return
        }
        toast.success("Product updated successfully!")
      } else {
        const { error } = await supabase
          .from("products")
          .insert(productData)

        if (error) {
          console.error("Error adding product:", error)
          
          // Handle specific constraint errors
          if (error.code === '23505') { // Unique constraint violation
            if (error.message.includes('barcode')) {
              toast.error(`Barcode "${formData.barcode}" already exists in another product`)
            } else if (error.message.includes('hsn_code')) {
              toast.error(`HSN code "${formData.hsn_code}" already exists in another product`)
            } else if (error.message.includes('name')) {
              toast.error(`Product name "${formData.name}" already exists in another product`)
            } else {
              toast.error(`Duplicate entry: ${error.message}`)
            }
          } else {
            toast.error(`Failed to add product: ${error.message}`)
          }
          return
        }
        toast.success("Product added successfully!")
      }

      setShowAddDialog(false)
      setEditingProduct(null)
      resetForm()
      fetchProducts()
    } catch (error: any) {
      console.error("Error saving product:", error)
      const errorMessage = error?.message || error?.details || "Unknown error occurred"
      toast.error(`Failed to save product: ${errorMessage}`)
    }
  }

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      price: product.price.toString(),
      cost_price: product.cost_price?.toString() || "",
      selling_price: product.selling_price?.toString() || "",
      stock_quantity: product.stock_quantity.toString(),
      min_stock_level: product.min_stock_level.toString(),
      gst_rate: product.gst_rate.toString(),
      price_includes_gst: product.price_includes_gst ? "true" : "false",
      hsn_code: product.hsn_code,
      brand: product.brand,
      barcode: product.barcode || "",
    })
    setShowAddDialog(true)
  }

  const handleDelete = async (productId: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return

    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", productId)

      if (error) {
        console.error("Error deleting product:", error)
        
        // Handle specific constraint errors
        if (error.code === '23503') { // Foreign key constraint violation
          toast.error("Cannot delete product: It is being used in transactions")
        } else {
          toast.error(`Failed to delete product: ${error.message}`)
        }
        return
      }
      toast.success("Product deleted successfully!")
      fetchProducts()
    } catch (error: any) {
      console.error("Error deleting product:", error)
      const errorMessage = error?.message || error?.details || "Unknown error occurred"
      toast.error(`Failed to delete product: ${errorMessage}`)
    }
  }

  const resetForm = () => {
          setFormData({
        name: "",
        price: "",
        cost_price: "",
        selling_price: "",
        stock_quantity: "",
        min_stock_level: "5",
        gst_rate: "18",
        price_includes_gst: "true",
        hsn_code: "",
        brand: "",
        barcode: "",
      })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Products</h1>
          <Button disabled>
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="border rounded-lg p-4 space-y-2 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-6 bg-gray-200 rounded w-1/2"></div>
              <div className="h-3 bg-gray-200 rounded w-full"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Products</h1>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by product name, HSN code, barcode, or brand..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            {searchTerm && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchTerm("")}
              >
                Clear
              </Button>
            )}
          </div>
          {searchTerm && (
            <p className="text-sm text-gray-500 mt-2">
              Found {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Barcode Scanner Instructions */}
      <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Scan className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-blue-900 dark:text-blue-100">Barcode Scanner Ready</h3>
          </div>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Connect your barcode scanner and press Enter to scan. The scanner will automatically focus on the barcode field.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.map((product) => (
          <Card key={product.id}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{product.name}</CardTitle>
                <div className="flex space-x-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(product)}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(product.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
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
                <Badge variant={product.stock_quantity > product.min_stock_level ? "default" : "destructive"}>
                  Stock: {product.stock_quantity}
                </Badge>
              </div>
              
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>Brand: {product.brand}</p>
                <p>HSN Code: {product.hsn_code}</p>
                <p>GST Rate: {product.gst_rate}%</p>
                <p>Price Includes GST: {product.price_includes_gst ? "Yes" : "No"}</p>
                <p>Min Level: {product.min_stock_level}</p>
                {product.cost_price && <p>Cost: {formatCurrency(product.cost_price)}</p>}
                {product.selling_price && <p>Selling: {formatCurrency(product.selling_price)}</p>}
                {product.barcode && <p>Barcode: {product.barcode}</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Edit Product" : "Add New Product"}
            </DialogTitle>
            <DialogDescription>
              {editingProduct ? "Update product details below." : "Enter product details below."}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Product Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

                                     <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">MRP (₹)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock_quantity">Stock Quantity</Label>
                <Input
                  id="stock_quantity"
                  type="number"
                  value={formData.stock_quantity}
                  onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cost_price">Cost Price (₹)</Label>
                <Input
                  id="cost_price"
                  type="number"
                  step="0.01"
                  value={formData.cost_price}
                  onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="selling_price">Selling Price (₹)</Label>
                <Input
                  id="selling_price"
                  type="number"
                  step="0.01"
                  value={formData.selling_price}
                  onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 relative">
                <Label htmlFor="brand">Brand</Label>
                <Input
                  id="brand"
                  value={formData.brand}
                  onChange={(e) => handleBrandInputChange(e.target.value)}
                  onBlur={() => setTimeout(() => setShowBrandSuggestions(false), 200)}
                  onFocus={() => {
                    if (formData.brand.trim()) {
                      handleBrandInputChange(formData.brand)
                    }
                  }}
                  placeholder="Type to search brands..."
                />
                {showBrandSuggestions && filteredBrands.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {filteredBrands.map((brand, index) => (
                      <div
                        key={index}
                        className="p-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
                        onClick={() => selectBrand(brand)}
                      >
                        {brand}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="hsn_code">HSN Code</Label>
                <Input
                  id="hsn_code"
                  value={formData.hsn_code}
                  onChange={(e) => setFormData({ ...formData, hsn_code: e.target.value })}
                  placeholder="999999"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min_stock_level">Min Stock Level</Label>
                <Input
                  id="min_stock_level"
                  type="number"
                  value={formData.min_stock_level}
                  onChange={(e) => setFormData({ ...formData, min_stock_level: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gst_rate">GST Rate (%)</Label>
                <Input
                  id="gst_rate"
                  type="number"
                  step="0.01"
                  value={formData.gst_rate}
                  onChange={(e) => setFormData({ ...formData, gst_rate: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="barcode" className="flex items-center gap-2">
                <Scan className="h-4 w-4" />
                Barcode (Optional)
              </Label>
              <Input
                id="barcode"
                ref={barcodeInputRef}
                value={formData.barcode}
                onChange={(e) => {
                  const value = e.target.value
                  setFormData({ ...formData, barcode: value })
                  
                  // Auto-detect barcode scan (if it ends with Enter)
                  if (value.endsWith('\n') || value.endsWith('\r')) {
                    const barcode = value.trim()
                    handleBarcodeScan(barcode)
                    e.target.value = barcode // Remove the Enter character
                  }
                }}
                placeholder="Scan barcode or enter manually"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const barcode = e.currentTarget.value.trim()
                    if (barcode) {
                      handleBarcodeScan(barcode)
                    }
                  }
                }}
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="price_includes_gst"
                checked={formData.price_includes_gst === "true"}
                onChange={(e) => setFormData({ ...formData, price_includes_gst: e.target.checked ? "true" : "false" })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <Label htmlFor="price_includes_gst" className="text-sm text-muted-foreground">
                Price includes GST (recommended)
              </Label>
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                {editingProduct ? "Update Product" : "Add Product"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddDialog(false)
                  setEditingProduct(null)
                  resetForm()
                }}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
