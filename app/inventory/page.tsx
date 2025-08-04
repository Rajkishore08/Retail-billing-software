"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase-client"
import { useAuth } from "@/contexts/auth-context"
import { Package, AlertTriangle, Plus, Minus, Search } from "lucide-react"
import { toast } from "sonner"

type Product = {
  id: string
  name: string
  stock_quantity: number
  min_stock_level: number
  hsn_code: string
  barcode?: string
  brand: string
}

export default function InventoryPage() {
  const { profile } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [adjustmentQuantity, setAdjustmentQuantity] = useState("")
  const [adjustmentNotes, setAdjustmentNotes] = useState("")
  const [showAdjustmentDialog, setShowAdjustmentDialog] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select(`
        id,
        name,
        stock_quantity,
        min_stock_level,
        hsn_code,
        barcode,
        brand
      `)
      .order("name")

    if (error) {
      console.error("Error fetching products:", error)
      return
    }

    setProducts(data || [])
    setLoading(false)
  }

  const filteredProducts = products.filter((product) => 
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.hsn_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.barcode && product.barcode.toLowerCase().includes(searchTerm.toLowerCase())) ||
    product.brand.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const lowStockProducts = filteredProducts.filter((product) => product.stock_quantity <= product.min_stock_level)

  const handleStockAdjustment = async () => {
    if (!selectedProduct || !adjustmentQuantity) return

    const quantity = Number.parseInt(adjustmentQuantity)
    if (isNaN(quantity)) return

    try {
      // Update product stock
      const newStockQuantity = selectedProduct.stock_quantity + quantity
      const { error: updateError } = await supabase
        .from("products")
        .update({ stock_quantity: newStockQuantity })
        .eq("id", selectedProduct.id)

      if (updateError) throw updateError

      // Record stock movement
      const { error: movementError } = await supabase.from("stock_movements").insert({
        product_id: selectedProduct.id,
        movement_type: "adjustment",
        quantity: quantity,
        notes: adjustmentNotes,
        created_by: profile?.id,
      })

      if (movementError) throw movementError

      // Refresh products
      fetchProducts()

      // Reset form
      setSelectedProduct(null)
      setAdjustmentQuantity("")
      setAdjustmentNotes("")
      setShowAdjustmentDialog(false)

      toast.success("Stock adjustment completed successfully!")
    } catch (error) {
      console.error("Error adjusting stock:", error)
      toast.error("Error adjusting stock")
    }
  }

  const openAdjustmentDialog = (product: Product) => {
    setSelectedProduct(product)
    setShowAdjustmentDialog(true)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Inventory</h1>
            <p className="text-muted-foreground">Monitor and manage stock levels</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-6 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Inventory</h1>
          <p className="text-muted-foreground">Monitor and manage stock levels</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Package className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{products.length}</p>
                <p className="text-sm text-muted-foreground">Total Products</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-8 w-8 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">{lowStockProducts.length}</p>
                <p className="text-sm text-muted-foreground">Low Stock Items</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Package className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{products.reduce((sum, p) => sum + p.stock_quantity, 0)}</p>
                <p className="text-sm text-muted-foreground">Total Stock Units</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          placeholder="Search by product name, HSN code, barcode, or brand..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
          <CardHeader>
            <CardTitle className="flex items-center text-orange-800 dark:text-orange-200">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Low Stock Alert
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {lowStockProducts.slice(0, 6).map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border"
                >
                  <div>
                    <p className="font-medium text-sm">{product.name}</p>
                    <p className="text-xs text-muted-foreground">Brand: {product.brand || "Generic"}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="destructive" className="text-xs">
                      {product.stock_quantity} left
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">Min: {product.min_stock_level}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredProducts.map((product) => (
          <Card
            key={product.id}
            className={product.stock_quantity <= product.min_stock_level ? "border-orange-200" : ""}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center justify-between">
                <span className="truncate">{product.name}</span>
                {product.stock_quantity <= product.min_stock_level && (
                  <AlertTriangle className="h-4 w-4 text-orange-600 flex-shrink-0 ml-2" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Current Stock:</span>
                  <Badge variant={product.stock_quantity <= product.min_stock_level ? "destructive" : "secondary"}>
                    {product.stock_quantity} units
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Min Level:</span>
                  <span className="text-sm">{product.min_stock_level} units</span>
                </div>
                                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Brand:</span>
                    <span className="text-sm">{product.brand || "Generic"}</span>
                  </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full bg-transparent"
                  onClick={() => openAdjustmentDialog(product)}
                >
                  Adjust Stock
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Stock Adjustment Dialog */}
      <Dialog open={showAdjustmentDialog} onOpenChange={setShowAdjustmentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock - {selectedProduct?.name}</DialogTitle>
            <DialogDescription>
              Adjust stock quantity for this product
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Current Stock: <span className="font-medium">{selectedProduct?.stock_quantity} units</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjustment">Adjustment Quantity</Label>
              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setAdjustmentQuantity((-Math.abs(Number.parseInt(adjustmentQuantity) || 1)).toString())
                  }
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  id="adjustment"
                  type="number"
                  value={adjustmentQuantity}
                  onChange={(e) => setAdjustmentQuantity(e.target.value)}
                  placeholder="Enter quantity (+/-)"
                  className="text-center"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAdjustmentQuantity(Math.abs(Number.parseInt(adjustmentQuantity) || 1).toString())}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Use positive numbers to add stock, negative to reduce</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Input
                id="notes"
                value={adjustmentNotes}
                onChange={(e) => setAdjustmentNotes(e.target.value)}
                placeholder="Reason for adjustment..."
              />
            </div>
            {adjustmentQuantity && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm">
                  <span className="font-medium">New Stock Level: </span>
                  {(selectedProduct?.stock_quantity || 0) + Number.parseInt(adjustmentQuantity)} units
                </p>
              </div>
            )}
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowAdjustmentDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleStockAdjustment} disabled={!adjustmentQuantity}>
                Apply Adjustment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {filteredProducts.length === 0 && (
        <div className="text-center py-12">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No products found</h3>
          <p className="text-muted-foreground">
            {searchTerm ? "Try adjusting your search terms" : "No products in inventory"}
          </p>
        </div>
      )}
    </div>
  )
}
