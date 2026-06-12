"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Plus, Edit, Trash2, Package, Scan, Search, ImagePlus,
  X, AlertTriangle, CheckCircle2, Tag, Barcode, Layers,
  Upload, Link2, Grid3X3, List, History,
} from "lucide-react"
import { supabase } from "@/lib/supabase-client"
import { toast } from "sonner"
import {
  getAllProductImages, setProductImage, removeProductImage,
  placeholderClass, initials,
} from "@/lib/product-image-store"
import { ProductHistoryTab } from "@/components/products/product-history-tab"
import { RouteGuard } from "@/components/auth/route-guard"

// ─── Types ─────────────────────────────────────────────────────────────────
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
  sale_unit?: string
}

const BLANK_FORM = {
  name: "", price: "", cost_price: "", selling_price: "",
  stock_quantity: "", min_stock_level: "5", gst_rate: "18",
  price_includes_gst: "true", hsn_code: "", brand: "", barcode: "",
  sale_unit: "pcs",
}

// ─── Product Image ─────────────────────────────────────────────────────────
function ProductImage({ product, images, size = "md" }: {
  product: Product
  images: Record<string, string>
  size?: "sm" | "md" | "lg"
}) {
  const url = images[product.id]
  const [err, setErr] = useState(false)
  const dim = size === "sm" ? "w-10 h-10 text-sm"
            : size === "lg" ? "w-full h-48 text-3xl"
            : "w-full h-40 text-2xl"

  if (url && !err) {
    return (
      <img
        src={url} alt={product.name}
        className={`${dim} object-cover`}
        onError={() => setErr(true)}
      />
    )
  }
  return (
    <div className={`${dim} ${placeholderClass(product.name)} flex items-center justify-center font-bold text-white`}>
      {initials(product.name)}
    </div>
  )
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(v)

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function ProductsPage() {
  const [products, setProducts]             = useState<Product[]>([])
  const [filtered, setFiltered]             = useState<Product[]>([])
  const [loading, setLoading]               = useState(true)
  const [showDialog, setShowDialog]         = useState(false)
  const [editing, setEditing]               = useState<Product | null>(null)
  const [searchTerm, setSearchTerm]         = useState("")
  const [formData, setFormData]             = useState({ ...BLANK_FORM })
  const [productImages, setProductImages]   = useState<Record<string, string>>({})
  const [pendingImage, setPendingImage]     = useState<string>("")
  const [imageMode, setImageMode]           = useState<"url" | "upload">("url")
  const [isScanning, setIsScanning]         = useState(false)
  const [brands, setBrands]                 = useState<string[]>([])
  const [showBrands, setShowBrands]         = useState(false)
  const [filteredBrands, setFilteredBrands] = useState<string[]>([])
  const [filterStock, setFilterStock]       = useState<"all" | "low" | "ok">("all")
  const [viewMode, setViewMode]             = useState<"grid" | "list">("grid")

  const barcodeRef = useRef<HTMLInputElement>(null)
  const fileRef    = useRef<HTMLInputElement>(null)

  useEffect(() => { setProductImages(getAllProductImages()) }, [])

  const fetchProducts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,price,cost_price,mrp,selling_price,stock_quantity,min_stock_level,gst_rate,price_includes_gst,hsn_code,brand,barcode")
        .order("name")
      if (error) { toast.error("Failed to load products"); return }
      setProducts(data || [])
      const uniq = [...new Set((data || []).map(p => p.brand).filter(Boolean))].sort()
      setBrands(uniq)
    } catch { toast.error("Failed to load products") }
    finally   { setLoading(false) }
  }, [])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  const filterProducts = useCallback(() => {
    let list = products
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.hsn_code.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
      )
    }
    if (filterStock === "low") list = list.filter(p => p.stock_quantity <= p.min_stock_level)
    if (filterStock === "ok")  list = list.filter(p => p.stock_quantity >  p.min_stock_level)
    setFiltered(list)
  }, [products, searchTerm, filterStock])

  useEffect(() => { filterProducts() }, [filterProducts])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (document.activeElement === barcodeRef.current) return
      if (e.key === "Enter" && !isScanning) {
        setIsScanning(true)
        setTimeout(() => setIsScanning(false), 1000)
        barcodeRef.current?.focus()
      }
    }
    window.addEventListener("keypress", handler)
    return () => window.removeEventListener("keypress", handler)
  }, [isScanning])

  const handleBrandInput = (val: string) => {
    setFormData(p => ({ ...p, brand: val }))
    if (val.trim()) {
      const f = brands.filter(b => b.toLowerCase().includes(val.toLowerCase()))
      setFilteredBrands(f)
      setShowBrands(f.length > 0)
    } else { setShowBrands(false) }
  }

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast.error("Image must be under 2 MB"); return }
    const reader = new FileReader()
    reader.onloadend = () => setPendingImage(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleBarcodeScan = (code: string) => {
    const existing = products.find(p => p.barcode === code)
    if (existing) {
      toast.info(`Product found: ${existing.name}`)
      openEdit(existing)
    } else {
      setFormData(p => ({ ...p, barcode: code }))
      toast.success(`Barcode scanned: ${code}`)
    }
  }

  const openAdd = () => {
    setEditing(null)
    setFormData({ ...BLANK_FORM })
    setPendingImage("")
    setShowDialog(true)
  }

  const openEdit = (product: Product) => {
    setEditing(product)
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
      sale_unit: product.sale_unit || "pcs",
    })
    setPendingImage(productImages[product.id] || "")
    setShowDialog(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const data = {
      name: formData.name,
      price: parseFloat(formData.price),
      cost_price: formData.cost_price ? parseFloat(formData.cost_price) : null,
      mrp: parseFloat(formData.price),
      selling_price: formData.selling_price ? parseFloat(formData.selling_price) : parseFloat(formData.price),
      stock_quantity: parseInt(formData.stock_quantity),
      min_stock_level: parseInt(formData.min_stock_level),
      gst_rate: parseFloat(formData.gst_rate),
      price_includes_gst: formData.price_includes_gst === "true",
      hsn_code: formData.hsn_code || "999999",
      brand: formData.brand || "Generic",
      barcode: formData.barcode || null,
      sale_unit: formData.sale_unit || "pcs",
    }
    try {
      if (!editing) {
        const { data: dup } = await supabase.from("products").select("id,name").eq("name", formData.name).single()
        if (dup) { toast.error(`"${formData.name}" already exists`); return }
        if (formData.barcode) {
          const { data: dupB } = await supabase.from("products").select("id,name").eq("barcode", formData.barcode).single()
          if (dupB) { toast.error(`Barcode already used by "${dupB.name}"`); return }
        }
        const { data: inserted, error } = await supabase.from("products").insert(data).select("id").single()
        if (error) { toast.error(`Failed to add: ${error.message}`); return }
        if (inserted && pendingImage) {
          setProductImage(inserted.id, pendingImage)
          setProductImages(getAllProductImages())
        }
        toast.success("Product added!")
      } else {
        const { error } = await supabase.from("products").update(data).eq("id", editing.id)
        if (error) { toast.error(`Failed to update: ${error.message}`); return }
        if (pendingImage) { setProductImage(editing.id, pendingImage) }
        else { removeProductImage(editing.id) }
        setProductImages(getAllProductImages())
        toast.success("Product updated!")
      }
      setShowDialog(false)
      setEditing(null)
      fetchProducts()
    } catch (err: any) {
      toast.error(`Error: ${err?.message || "Unknown"}`)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product? The record will be soft-deleted and preserved in history.")) return
    // Soft delete: set deleted_at instead of hard delete
    const { error } = await supabase
      .from("products")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
    if (error) {
      // If deleted_at column doesn't exist yet, fall back to filter from view
      if (error.code === "PGRST204" || error.message?.includes("deleted_at")) {
        const { error: hardErr } = await supabase.from("products").delete().eq("id", id)
        if (hardErr) {
          if (hardErr.code === "23503") toast.error("Cannot delete: product is used in transactions")
          else toast.error(`Delete failed: ${hardErr.message}`)
          return
        }
      } else {
        toast.error(`Delete failed: ${error.message}`)
        return
      }
    }
    removeProductImage(id)
    setProductImages(getAllProductImages())
    toast.success("Product deleted")
    fetchProducts()
  }

  const lowStockCount = products.filter(p => p.stock_quantity <= p.min_stock_level).length

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-36 skeleton rounded-2xl" />
        <div className="flex gap-3">
          <div className="h-10 skeleton rounded-xl flex-1" />
          <div className="h-10 skeleton rounded-xl w-32" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-border overflow-hidden">
              <div className="h-48 skeleton" />
              <div className="p-4 space-y-2.5">
                <div className="h-4 skeleton rounded-lg w-3/4" />
                <div className="h-6 skeleton rounded-lg w-1/2" />
                <div className="h-3 skeleton rounded-lg w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <RouteGuard module="products">
    <div className="space-y-6 animate-fade-in-up">

      {/* ── Tabs (Products / History) ────────────────── */}
      <Tabs defaultValue="catalog" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <TabsList className="h-11 px-1.5 rounded-xl bg-card border border-border gap-1">
            <TabsTrigger value="catalog" className="rounded-lg text-sm font-semibold px-5">
              <Package className="h-3.5 w-3.5 mr-2" />Products
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg text-sm font-semibold px-5">
              <History className="h-3.5 w-3.5 mr-2" />Product History
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Catalog Tab ─────────────────────────────── */}
        <TabsContent value="catalog" className="space-y-6 mt-0">
      {/* ── Page Header Banner ─────────────────────────── */}
      <div className="page-header-banner">
        <div
          className="absolute top-[-40px] right-[-30px] w-40 h-40 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle,rgba(124,58,237,0.3),transparent 70%)" }}
        />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                <Package className="h-4 w-4 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Products</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.85)" }}>
                <Package className="h-3 w-3" />
                {products.length} Products
              </span>
              {lowStockCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{ background: "rgba(217,119,6,0.2)", color: "#fcd34d", border: "1px solid rgba(217,119,6,0.3)" }}>
                  <AlertTriangle className="h-3 w-3" />
                  {lowStockCount} Low Stock
                </span>
              )}
            </div>
          </div>
          <Button
            onClick={openAdd}
            className="h-11 px-6 rounded-xl font-semibold gradient-primary border-0 shadow-xl hover:opacity-90 glow-violet text-white shrink-0"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      {/* ── Search & Filters ───────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, brand, HSN, barcode…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10 h-11 rounded-xl border-border bg-card"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Stock filter pills */}
        <div className="flex gap-2">
          {(["all","ok","low"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterStock(f)}
              className={[
                "px-4 h-11 rounded-xl text-sm font-semibold border transition-all",
                filterStock === f
                  ? f === "low"
                    ? "bg-amber-500/20 border-amber-500/50 text-amber-400"
                    : f === "ok"
                    ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                    : "gradient-primary border-0 text-white shadow-md"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-card",
              ].join(" ")}
            >
              {f === "all" ? "All" : f === "ok" ? "✓ In Stock" : "⚠ Low Stock"}
            </button>
          ))}

          {/* View toggle */}
          <div className="flex gap-1 p-1 rounded-xl bg-card border border-border">
            <button onClick={() => setViewMode("grid")}
              className={`p-2 rounded-lg transition-all ${viewMode === "grid" ? "gradient-primary text-white shadow-md" : "text-muted-foreground hover:text-foreground"}`}>
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button onClick={() => setViewMode("list")}
              className={`p-2 rounded-lg transition-all ${viewMode === "list" ? "gradient-primary text-white shadow-md" : "text-muted-foreground hover:text-foreground"}`}>
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Low-stock banner */}
      {lowStockCount > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/8">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
            <span className="font-bold">{lowStockCount} product{lowStockCount > 1 ? "s are" : " is"}</span> below minimum stock level — reorder soon.
          </p>
        </div>
      )}

      {searchTerm && (
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-bold text-foreground">{filtered.length}</span> result{filtered.length !== 1 ? "s" : ""} for &ldquo;{searchTerm}&rdquo;
        </p>
      )}

      {/* ── Product Grid / Empty State ─────────────────── */}
      {filtered.length === 0 ? (
        <div className="text-center py-24 animate-fade-in">
          <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-5 glow-violet">
            <Package className="h-10 w-10 text-white" />
          </div>
          <h3 className="text-xl font-bold mb-2">No products found</h3>
          <p className="text-muted-foreground text-sm mb-7 max-w-xs mx-auto">
            {searchTerm ? "Try a different search term or clear the filter." : "Add your first product to get started."}
          </p>
          {!searchTerm && (
            <Button onClick={openAdd} className="gradient-primary border-0 rounded-xl px-8 h-11 font-semibold shadow-lg glow-violet">
              <Plus className="h-4 w-4 mr-2" /> Add First Product
            </Button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((product, idx) => {
            const isLow  = product.stock_quantity <= product.min_stock_level
            const price  = product.selling_price || product.price
            const hasMrp = product.mrp && product.mrp > price
            const discount = hasMrp ? Math.round((1 - price / product.mrp!) * 100) : 0

            return (
              <Card
                key={product.id}
                className={`border border-border rounded-2xl overflow-hidden card-hover animate-fade-in-up stagger-${Math.min(idx+1,4)} group`}
                style={{ animationDelay: `${(idx % 8) * 0.05}s`, animationFillMode: "forwards" }}
              >
                {/* Image area */}
                <div className="relative overflow-hidden">
                  <ProductImage product={product} images={productImages} size="lg" />
                  {/* Gradient overlay at bottom of image */}
                  <div className="img-card-overlay" />

                  {/* Badges on top of image */}
                  <div className="absolute top-2.5 left-2.5 right-2.5 flex justify-between items-start">
                    {discount > 0 ? (
                      <span className="bg-rose-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg">
                        -{discount}%
                      </span>
                    ) : <span />}
                    <span className={[
                      "text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg backdrop-blur-sm",
                      isLow ? "bg-amber-500/90 text-white" : "bg-emerald-500/90 text-white",
                    ].join(" ")}>
                      {isLow ? "⚠ Low" : "✓ In Stock"}
                    </span>
                  </div>

                  {/* Price shown at bottom of image */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 flex items-end justify-between">
                    <span className="text-xl font-bold text-white font-numeric drop-shadow-lg">
                      {formatCurrency(price)}
                    </span>
                    {hasMrp && (
                      <span className="text-xs text-white/60 line-through drop-shadow">
                        MRP {formatCurrency(product.mrp!)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Content */}
                <CardContent className="p-4 space-y-3">
                  <div>
                    <h3 className="font-bold text-sm leading-tight line-clamp-1">{product.name}</h3>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-muted-foreground">{product.brand}</p>
                      <span className={`text-xs font-bold ${isLow ? "text-amber-500" : "text-slate-400"}`}>
                        Qty: {product.stock_quantity}
                      </span>
                    </div>
                  </div>

                  {/* Info pills */}
                  <div className="flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/12 text-violet-400 border border-violet-500/20">
                      <Tag className="h-2.5 w-2.5" />GST {product.gst_rate}%
                    </span>
                    {product.barcode && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/12 text-sky-400 border border-sky-500/20">
                        <Barcode className="h-2.5 w-2.5" />{product.barcode.slice(-6)}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20">
                      <Layers className="h-2.5 w-2.5" />{product.hsn_code}
                    </span>
                  </div>

                  <div className="divider" />

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(product)}
                      className="flex-1 h-9 rounded-lg text-xs font-semibold hover:border-violet-500/50 hover:text-violet-400 hover:bg-violet-500/5 transition-colors">
                      <Edit className="h-3 w-3 mr-1.5" /> Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(product.id)}
                      className="flex-1 h-9 rounded-lg text-xs font-semibold hover:border-rose-500/50 hover:text-rose-400 hover:bg-rose-500/5 transition-colors">
                      <Trash2 className="h-3 w-3 mr-1.5" /> Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        /* ── List View ── */
        <div className="space-y-2">
          {filtered.map((product, idx) => {
            const isLow = product.stock_quantity <= product.min_stock_level
            const price = product.selling_price || product.price
            return (
              <div key={product.id}
                className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-violet-500/30 transition-colors animate-fade-in-up"
                style={{ animationDelay: `${idx * 0.03}s`, animationFillMode: "forwards" }}>
                {/* Mini image */}
                <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-border">
                  <ProductImage product={product} images={productImages} size="sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">{product.name}</h3>
                  <p className="text-xs text-muted-foreground">{product.brand}</p>
                </div>
                <span className="font-bold text-sm text-emerald-500 font-numeric shrink-0">
                  {formatCurrency(price)}
                </span>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${isLow ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400"}`}>
                  {isLow ? "⚠" : "✓"} {product.stock_quantity} left
                </span>
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => openEdit(product)}
                    className="h-8 w-8 p-0 rounded-lg hover:border-violet-500/50 hover:text-violet-400">
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(product.id)}
                    className="h-8 w-8 p-0 rounded-lg hover:border-rose-500/50 hover:text-rose-400">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Add / Edit Dialog ──────────────────────────── */}
      <Dialog open={showDialog} onOpenChange={v => { setShowDialog(v); if (!v) { setEditing(null); setPendingImage("") } }}>
        <DialogContent className="max-w-xl rounded-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader className="pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center">
                <Package className="h-4.5 w-4.5 text-white h-[18px] w-[18px]" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">
                  {editing ? "Edit Product" : "Add New Product"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {editing ? "Update product details below." : "Fill in the product details below."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6 mt-2">

            {/* ── Image Section ───────────────────────── */}
            <div className="space-y-3">
              <p className="section-label flex items-center gap-2">
                <ImagePlus className="h-3.5 w-3.5" />
                Product Image
                <span className="normal-case font-normal text-slate-500 lowercase tracking-normal">— optional</span>
              </p>

              <div className="flex gap-4">
                {/* Preview box */}
                <div className="w-24 h-24 rounded-xl overflow-hidden border-2 border-border shrink-0 relative">
                  {pendingImage ? (
                    <>
                      <img src={pendingImage} alt="preview" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setPendingImage("")}
                        className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center hover:bg-rose-500/80 transition-colors">
                        <X className="h-2.5 w-2.5 text-white" />
                      </button>
                    </>
                  ) : (
                    <div className={`w-full h-full ${placeholderClass(formData.name || "P")} flex items-center justify-center text-white font-bold text-2xl`}>
                      {initials(formData.name || "?")}
                    </div>
                  )}
                </div>

                {/* Controls */}
                <div className="flex-1 space-y-3">
                  {/* Mode toggle */}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setImageMode("url")}
                      className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-semibold border transition-all ${imageMode === "url" ? "gradient-primary border-0 text-white shadow-md" : "border-border text-muted-foreground hover:text-foreground"}`}>
                      <Link2 className="h-3 w-3" /> URL
                    </button>
                    <button type="button" onClick={() => setImageMode("upload")}
                      className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-semibold border transition-all ${imageMode === "upload" ? "gradient-primary border-0 text-white shadow-md" : "border-border text-muted-foreground hover:text-foreground"}`}>
                      <Upload className="h-3 w-3" /> Upload
                    </button>
                  </div>

                  {imageMode === "url" ? (
                    <Input
                      placeholder="https://example.com/product.jpg"
                      value={pendingImage.startsWith("data:") ? "" : pendingImage}
                      onChange={e => setPendingImage(e.target.value)}
                      className="h-10 rounded-xl text-sm"
                    />
                  ) : (
                    <>
                      <input type="file" ref={fileRef} accept="image/*" onChange={handleImageFile} className="hidden" />
                      <div
                        className="upload-zone flex items-center justify-center gap-3 h-10 px-4 cursor-pointer rounded-xl"
                        onClick={() => fileRef.current?.click()}
                      >
                        <Upload className="h-4 w-4 text-violet-400" />
                        <span className="text-sm text-muted-foreground font-medium">Click to choose image (max 2 MB)</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="divider" />

            {/* ── Product Details ───────────────────── */}
            <div className="space-y-4">
              <p className="section-label">Product Details</p>

              {/* Name */}
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm font-semibold">Product Name *</Label>
                <Input id="name" value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="h-10 rounded-xl" required placeholder="e.g. Tata Tea Gold 500g" />
              </div>

              {/* MRP + Stock */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="price" className="text-sm font-semibold">MRP (₹) *</Label>
                  <Input id="price" type="number" step="0.01" value={formData.price}
                    onChange={e => setFormData({ ...formData, price: e.target.value })}
                    className="h-10 rounded-xl" required placeholder="0.00" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="stock_quantity" className="text-sm font-semibold">Stock Qty *</Label>
                  <Input id="stock_quantity" type="number" value={formData.stock_quantity}
                    onChange={e => setFormData({ ...formData, stock_quantity: e.target.value })}
                    className="h-10 rounded-xl" required placeholder="0" />
                </div>
              </div>

              {/* Cost + Selling */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cost_price" className="text-sm font-semibold">Cost Price (₹)</Label>
                  <Input id="cost_price" type="number" step="0.01" value={formData.cost_price}
                    onChange={e => setFormData({ ...formData, cost_price: e.target.value })}
                    placeholder="0.00" className="h-10 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="selling_price" className="text-sm font-semibold">Selling Price (₹)</Label>
                  <Input id="selling_price" type="number" step="0.01" value={formData.selling_price}
                    onChange={e => setFormData({ ...formData, selling_price: e.target.value })}
                    placeholder="0.00" className="h-10 rounded-xl" />
                </div>
              </div>
            </div>

            <div className="divider" />

            {/* ── Categorization ────────────────────── */}
            <div className="space-y-4">
              <p className="section-label">Categorization & Tax</p>

              {/* Brand + HSN + Sale Unit */}
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1.5 relative">
                  <Label htmlFor="brand" className="text-sm font-semibold">Brand</Label>
                  <Input id="brand" value={formData.brand}
                    onChange={e => handleBrandInput(e.target.value)}
                    onBlur={() => setTimeout(() => setShowBrands(false), 200)}
                    onFocus={() => formData.brand.trim() && handleBrandInput(formData.brand)}
                    placeholder="Type to search…" className="h-10 rounded-xl" />
                  {showBrands && filteredBrands.length > 0 && (
                    <div className="absolute z-20 mt-1 w-full bg-popover border border-border rounded-xl shadow-xl max-h-40 overflow-y-auto">
                      {filteredBrands.map((b, i) => (
                        <div key={i} onClick={() => { setFormData(p => ({ ...p, brand: b })); setShowBrands(false) }}
                          className="p-2.5 cursor-pointer hover:bg-accent text-sm first:rounded-t-xl last:rounded-b-xl">
                          {b}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hsn_code" className="text-sm font-semibold">HSN Code</Label>
                  <Input id="hsn_code" value={formData.hsn_code}
                    onChange={e => setFormData({ ...formData, hsn_code: e.target.value })}
                    placeholder="999999" className="h-10 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sale_unit" className="text-sm font-semibold">Sale Unit *</Label>
                  <select
                    id="sale_unit"
                    value={formData.sale_unit}
                    onChange={e => setFormData({ ...formData, sale_unit: e.target.value })}
                    className="flex h-10 w-full rounded-xl border border-input bg-background text-foreground px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="pcs" className="bg-background text-foreground">Pieces (pcs)</option>
                    <option value="kg" className="bg-background text-foreground">Kilograms (kg)</option>
                  </select>
                </div>
              </div>

              {/* Min stock + GST */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="min_stock_level" className="text-sm font-semibold">Min Stock Level *</Label>
                  <Input id="min_stock_level" type="number" value={formData.min_stock_level}
                    onChange={e => setFormData({ ...formData, min_stock_level: e.target.value })}
                    className="h-10 rounded-xl" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gst_rate" className="text-sm font-semibold">GST Rate (%) *</Label>
                  <Input id="gst_rate" type="number" step="0.01" value={formData.gst_rate}
                    onChange={e => setFormData({ ...formData, gst_rate: e.target.value })}
                    className="h-10 rounded-xl" required />
                </div>
              </div>
            </div>

            <div className="divider" />

            {/* ── Barcode ───────────────────────────── */}
            <div className="space-y-3">
              <p className="section-label flex items-center gap-2">
                <Scan className="h-3.5 w-3.5" /> Barcode
              </p>
              <Input id="barcode" ref={barcodeRef} value={formData.barcode}
                onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleBarcodeScan(e.currentTarget.value.trim()) } }}
                placeholder="Scan or enter barcode (optional)" className="h-10 rounded-xl" />
            </div>

            {/* Price includes GST toggle */}
            <label className="flex items-center gap-3 p-4 rounded-xl border border-border cursor-pointer hover:bg-accent/40 transition-colors">
              <input type="checkbox"
                checked={formData.price_includes_gst === "true"}
                onChange={e => setFormData({ ...formData, price_includes_gst: e.target.checked ? "true" : "false" })}
                className="w-4 h-4 rounded accent-violet-600" />
              <div className="flex-1">
                <p className="text-sm font-semibold">Price includes GST</p>
                <p className="text-xs text-muted-foreground mt-0.5">Recommended for most retail products</p>
              </div>
              {formData.price_includes_gst === "true" && (
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              )}
            </label>

            {/* Submit */}
            <div className="flex gap-3 pt-1">
              <Button type="submit" className="flex-1 h-11 rounded-xl gradient-primary border-0 font-semibold shadow-lg">
                {editing ? "Update Product" : "Add Product"}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setShowDialog(false); setEditing(null) }}
                className="flex-1 h-11 rounded-xl font-semibold">
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
        </TabsContent>

        {/* ── History Tab ──────────────────────────────── */}
        <TabsContent value="history" className="mt-0">
          <ProductHistoryTab />
        </TabsContent>
      </Tabs>
    </div>
    </RouteGuard>
  )
}
