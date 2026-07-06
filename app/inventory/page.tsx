"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase-client"
import { useAuth } from "@/contexts/auth-context"
import {
  Package, AlertTriangle, Plus, Minus, Search, ScanLine,
  CheckCircle2, TrendingDown, TrendingUp, X, History, Box,
  Warehouse,
} from "lucide-react"
import { toast } from "sonner"
import { getAllProductImages, placeholderClass, initials } from "@/lib/product-image-store"
import { RouteGuard } from "@/components/auth/route-guard"

type Product = {
  id: string
  name: string
  stock_quantity: number
  min_stock_level: number
  hsn_code: string
  barcode?: string
  brand: string
}

type StockMovement = {
  id: string
  product_id: string
  movement_type: string
  quantity: number
  notes: string | null
  created_at: string
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
  const [adjusting, setAdjusting] = useState(false)
  const [productImages, setProductImages] = useState<Record<string, string>>({})
  const [barcodeInput, setBarcodeInput] = useState("")
  const barcodeRef = useRef<HTMLInputElement>(null)
  const searchRef  = useRef<HTMLInputElement>(null)
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)

  useEffect(() => {
    fetchProducts()
    setProductImages(getAllProductImages())
  }, [])

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, stock_quantity, min_stock_level, hsn_code, barcode, brand")
      .order("name")
    if (!error) setProducts(data || [])
    setLoading(false)
  }

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.hsn_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase())) ||
    p.brand?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const lowStockProducts = products.filter((p) => p.stock_quantity <= p.min_stock_level)
  const totalUnits = products.reduce((s, p) => s + p.stock_quantity, 0)

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const term = searchTerm.trim()
      if (!term) return
      const match = products.find((p) => p.barcode === term || p.name.toLowerCase() === term.toLowerCase())
      if (match) { openAdjustmentDialog(match); setSearchTerm("") }
    }
  }

  const handleBarcodeInDialog = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const code = barcodeInput.trim()
      if (!code) return
      const match = products.find((p) => p.barcode === code || p.name.toLowerCase() === code.toLowerCase())
      if (match) {
        setSelectedProduct(match)
        setBarcodeInput("")
        toast.success(`Product found: ${match.name}`)
      } else {
        toast.error("No product found")
      }
    }
  }

  const handleStockAdjustment = async () => {
    if (!selectedProduct || !adjustmentQuantity) return
    const qty = parseInt(adjustmentQuantity)
    if (isNaN(qty)) return
    setAdjusting(true)
    try {
      const newStock = selectedProduct.stock_quantity + qty
      if (newStock < 0) { toast.error("Stock cannot go below 0"); return }
      const { error: err } = await supabase.from("products").update({ stock_quantity: newStock }).eq("id", selectedProduct.id)
      if (err) throw err
      try {
        await supabase.from("stock_movements").insert({
          product_id: selectedProduct.id,
          movement_type: qty > 0 ? "restock" : "adjustment",
          quantity: qty,
          notes: adjustmentNotes || null,
          created_by: profile?.id,
        })
      } catch {}
      await fetchProducts()
      setShowAdjustmentDialog(false)
      toast.success("Stock updated!")
    } catch { toast.error("Failed to update") }
    finally { setAdjusting(false) }
  }

  const openHistory = async (product: Product) => {
    setHistoryProduct(product)
    setShowHistory(true)
    setHistoryLoading(true)
    try {
      const { data } = await supabase.from("stock_movements").select("*")
        .eq("product_id", product.id).order("created_at", { ascending: false }).limit(20)
      setStockMovements(data || [])
    } finally { setHistoryLoading(false) }
  }

  const openAdjustmentDialog = (product: Product | null = null) => {
    setSelectedProduct(product)
    setAdjustmentQuantity("")
    setAdjustmentNotes("")
    setBarcodeInput("")
    setShowAdjustmentDialog(true)
    setTimeout(() => barcodeRef.current?.focus(), 100)
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-36 skeleton rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[1,2,3].map(i => <div key={i} className="h-28 skeleton rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mt-4">
          {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="h-44 skeleton rounded-2xl" />)}
        </div>
      </div>
    )
  }

  return (
    <RouteGuard module="inventory">
    <div className="space-y-6 animate-fade-in-up">

      {/* ── Page Header Banner ─────────────────────────── */}
      <div className="page-header-banner">
        <div
          className="absolute top-[-40px] right-[-30px] w-44 h-44 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle,rgba(5,150,105,0.3),transparent 70%)" }}
        />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg gradient-emerald flex items-center justify-center">
                <Warehouse className="h-4 w-4 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Inventory</h1>
            </div>
            <p className="text-sky-300/70 text-sm font-medium">
              Monitor, adjust, and track stock movements in real time.
            </p>
          </div>
          <Button
            onClick={() => openAdjustmentDialog(null)}
            className="h-11 px-6 rounded-xl font-semibold border-0 shadow-xl hover:opacity-90 text-white shrink-0"
            style={{ background: "linear-gradient(135deg,#059669,#047857)", boxShadow: "0 4px 20px rgba(5,150,105,0.4)" }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Adjust Stock
          </Button>
        </div>
      </div>

      {/* ── Summary Cards ──────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          {
            label: "Total Products", val: products.length, icon: Package,
            gradient: "linear-gradient(135deg,#1d4ed8,#1e3a8a)",
            iconColor: "#93c5fd", iconBg: "rgba(37,99,235,0.15)",
            accent: "stat-card-blue", glow: "glow-blue",
          },
          {
            label: "Total Units in Stock", val: totalUnits, icon: Box,
            gradient: "linear-gradient(135deg,#0284c7,#075985)",
            iconColor: "#7dd3fc", iconBg: "rgba(2,132,199,0.15)",
            accent: "stat-card-sky", glow: "glow-sky",
          },
          {
            label: "Low Stock Items", val: lowStockProducts.length, icon: AlertTriangle,
            gradient: lowStockProducts.length > 0 ? "linear-gradient(135deg,#e11d48,#be123c)" : "linear-gradient(135deg,#059669,#047857)",
            iconColor: lowStockProducts.length > 0 ? "#fca5a5" : "#6ee7b7",
            iconBg: lowStockProducts.length > 0 ? "rgba(225,29,72,0.15)" : "rgba(5,150,105,0.15)",
            accent: lowStockProducts.length > 0 ? "stat-card-rose" : "stat-card-emerald",
            glow: lowStockProducts.length > 0 ? "glow-rose" : "glow-emerald",
          },
        ].map((s, i) => (
          <div
            key={i}
            className={`rounded-2xl overflow-hidden card-hover ${s.accent} ${s.glow} stagger-${i+1} animate-fade-in-up`}
            style={{
              background: "linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
              border: "1px solid rgba(255,255,255,0.07)",
              animationDelay: `${i * 0.07}s`,
              animationFillMode: "forwards",
            }}
          >
            <div className="p-5 flex items-center gap-4">
              <div className="w-13 h-13 rounded-2xl flex items-center justify-center shrink-0 shadow-lg w-[52px] h-[52px]"
                style={{ background: s.gradient }}>
                <s.icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold font-numeric" style={{ color: s.iconColor }}>{s.val}</p>
                <p className="text-sm font-medium text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Search ─────────────────────────────────────── */}
      <div className="relative max-w-xl">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={searchRef}
          placeholder="Search items or scan barcode + Enter…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          className="pl-10 h-11 rounded-xl bg-card border-border pr-28"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm("")}
            className="absolute right-[90px] top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <Badge className="bg-white/8 text-slate-300 pointer-events-none rounded-lg text-[10px] gap-1 px-2 border-white/10">
            <ScanLine className="h-3 w-3" /> SCAN
          </Badge>
        </div>
      </div>

      {/* ── Low Stock Alert Banner ──────────────────────── */}
      {lowStockProducts.length > 0 && (
        <div className="flex items-start gap-4 p-5 rounded-xl border border-rose-500/30 bg-rose-500/8">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center shrink-0 animate-pulse-ring">
            <AlertTriangle className="h-5 w-5 text-rose-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-rose-400 mb-0.5">
              Low Stock Alert — {lowStockProducts.length} item{lowStockProducts.length > 1 ? "s" : ""}
            </h3>
            <p className="text-xs text-rose-500/70 mb-3">These items are below minimum stock level and need restocking:</p>
            <div className="flex flex-wrap gap-2">
              {lowStockProducts.slice(0, 8).map(p => (
                <button
                  key={p.id}
                  onClick={() => openAdjustmentDialog(p)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all hover:scale-105"
                  style={{ background: "rgba(225,29,72,0.15)", color: "#fca5a5", border: "1px solid rgba(225,29,72,0.25)" }}
                >
                  <span className="truncate max-w-[100px]">{p.name}</span>
                  <span className="bg-rose-500 text-white px-1.5 py-0.5 rounded-md text-[10px] font-bold shrink-0">
                    {p.stock_quantity}
                  </span>
                </button>
              ))}
              {lowStockProducts.length > 8 && (
                <span className="text-xs text-rose-400/60 self-center">+{lowStockProducts.length - 8} more</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Products Grid ───────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {filteredProducts.map((p, i) => {
          const isLow = p.stock_quantity <= p.min_stock_level
          const pct   = p.min_stock_level > 0 ? Math.min((p.stock_quantity / (p.min_stock_level * 3)) * 100, 100) : 100
          const progressClass = isLow ? "progress-fill-rose" : pct < 60 ? "progress-fill-amber" : "progress-fill-emerald"

          return (
            <Card
              key={p.id}
              className={`border-border bg-card rounded-2xl overflow-hidden card-hover stagger-${Math.min(i+1,4)} animate-fade-in-up`}
              style={{ animationDelay: `${(i % 8) * 0.04}s`, animationFillMode: "forwards" }}
            >
              <div className="p-4 space-y-3">
                {/* Product header */}
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-border shadow-md">
                    {productImages[p.id] ? (
                      <img src={productImages[p.id]} className="w-full h-full object-cover" alt={p.name} />
                    ) : (
                      <div className={`w-full h-full ${placeholderClass(p.name)} text-white font-bold text-sm flex items-center justify-center`}>
                        {initials(p.name)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm leading-tight truncate">{p.name}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{p.brand}</p>
                    {p.barcode && (
                      <p className="text-[10px] text-slate-500 mt-0.5 font-mono">{p.barcode.slice(-8)}</p>
                    )}
                  </div>
                  {/* Stock badge */}
                  <span
                    className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg ${
                      isLow ? "bg-rose-500/20 text-rose-400" : "bg-emerald-500/20 text-emerald-400"
                    }`}
                  >
                    {isLow ? "LOW" : "OK"}
                  </span>
                </div>

                {/* Stock quantities */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl text-center"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-lg font-bold font-numeric" style={{ color: isLow ? "#fca5a5" : "#6ee7b7" }}>
                      {p.stock_quantity}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">Current Qty</p>
                  </div>
                  <div className="p-2.5 rounded-xl text-center"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-lg font-bold font-numeric text-slate-300">{p.min_stock_level}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">Min Level</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-muted-foreground">Stock Level</span>
                    <span className="text-[10px] font-semibold" style={{ color: isLow ? "#fca5a5" : "#6ee7b7" }}>
                      {Math.round(pct)}%
                    </span>
                  </div>
                  <div className="progress-track">
                    <div className={`progress-fill ${progressClass}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => openAdjustmentDialog(p)}
                    className="flex-1 h-9 text-xs font-semibold rounded-xl hover:border-emerald-500/50 hover:text-emerald-400 hover:bg-emerald-500/5 transition-colors">
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Adjust
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openHistory(p)}
                    className="h-9 px-3 rounded-xl hover:border-blue-500/50 hover:text-blue-400 hover:bg-blue-500/5 shrink-0 transition-colors">
                    <History className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {filteredProducts.length === 0 && !loading && (
        <div className="text-center py-20 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl gradient-emerald flex items-center justify-center mx-auto mb-4">
            <Package className="h-8 w-8 text-white" />
          </div>
          <h3 className="font-bold text-lg mb-1">No products found</h3>
          <p className="text-sm text-muted-foreground">Try a different search term.</p>
        </div>
      )}

      {/* ── Adjust Dialog ──────────────────────────────── */}
      <Dialog open={showAdjustmentDialog} onOpenChange={setShowAdjustmentDialog}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", paddingBottom: "1rem" }}>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl gradient-emerald flex items-center justify-center">
                <Package className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="font-bold text-base">Adjust Stock</p>
                <p className="text-xs text-muted-foreground font-normal mt-0.5">Update inventory levels</p>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 mt-4">
            {!selectedProduct && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Scan or Type Product</Label>
                <div className="relative">
                  <ScanLine className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
                  <Input
                    ref={barcodeRef}
                    value={barcodeInput}
                    onChange={e => setBarcodeInput(e.target.value)}
                    onKeyDown={handleBarcodeInDialog}
                    placeholder="Barcode or Product Name + Enter"
                    className="pl-10 h-11 rounded-xl bg-card border-border"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Or search in the main list and click Adjust</p>
              </div>
            )}

            {selectedProduct && (
              <div className="animate-fade-in-up space-y-5">
                {/* Product info card */}
                <div className="flex items-center gap-3 p-4 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 shadow-md">
                    {productImages[selectedProduct.id] ? (
                      <img src={productImages[selectedProduct.id]} className="w-full h-full object-cover" alt={selectedProduct.name} />
                    ) : (
                      <div className={`w-full h-full ${placeholderClass(selectedProduct.name)} text-white font-bold flex items-center justify-center`}>
                        {initials(selectedProduct.name)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm truncate">{selectedProduct.name}</h3>
                    <p className="text-xs text-muted-foreground">{selectedProduct.brand}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-xs text-muted-foreground">Current Stock:</span>
                      <span className="text-sm font-bold text-emerald-400 font-numeric">
                        {selectedProduct.stock_quantity}
                      </span>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => setSelectedProduct(null)}
                    className="h-7 w-7 rounded-full hover:bg-white/10 shrink-0">
                    <X className="h-3 w-3" />
                  </Button>
                </div>

                {/* Quantity adjuster */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Quantity to Add / Remove</Label>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline"
                      onClick={() => setAdjustmentQuantity(String(-Math.abs(parseInt(adjustmentQuantity) || 1)))}
                      className="h-13 w-13 h-[52px] w-[52px] rounded-xl bg-white/5 border-white/10 hover:bg-rose-500/15 hover:text-rose-400 hover:border-rose-500/40 flex-shrink-0 text-lg">
                      <Minus className="h-5 w-5" />
                    </Button>
                    <Input
                      type="number"
                      value={adjustmentQuantity}
                      onChange={e => setAdjustmentQuantity(e.target.value)}
                      placeholder="0"
                      className="h-[52px] flex-1 rounded-xl text-center text-2xl font-bold font-numeric bg-card border-border"
                    />
                    <Button type="button" variant="outline"
                      onClick={() => setAdjustmentQuantity(String(Math.abs(parseInt(adjustmentQuantity) || 1)))}
                      className="h-[52px] w-[52px] rounded-xl bg-white/5 border-white/10 hover:bg-emerald-500/15 hover:text-emerald-400 hover:border-emerald-500/40 flex-shrink-0 text-lg">
                      <Plus className="h-5 w-5" />
                    </Button>
                  </div>

                  {adjustmentQuantity && !isNaN(parseInt(adjustmentQuantity)) && (
                    <div className="flex items-center justify-center gap-2 pt-1">
                      <span className="text-xs text-muted-foreground">New Total:</span>
                      <span className={`text-lg font-bold font-numeric ${
                        (selectedProduct.stock_quantity + parseInt(adjustmentQuantity)) < 0
                          ? "text-rose-500" : "text-emerald-400"
                      }`}>
                        {selectedProduct.stock_quantity + parseInt(adjustmentQuantity)}
                      </span>
                      {parseInt(adjustmentQuantity) > 0
                        ? <TrendingUp className="h-4 w-4 text-emerald-400" />
                        : <TrendingDown className="h-4 w-4 text-rose-400" />
                      }
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Notes <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                  <Input
                    value={adjustmentNotes}
                    onChange={e => setAdjustmentNotes(e.target.value)}
                    placeholder="Reason for adjustment…"
                    className="h-10 rounded-xl bg-card border-border"
                  />
                </div>

                <Button
                  onClick={handleStockAdjustment}
                  disabled={!adjustmentQuantity || adjusting || (selectedProduct.stock_quantity + parseInt(adjustmentQuantity)) < 0}
                  className="w-full h-11 rounded-xl font-bold border-0 text-white shadow-lg"
                  style={{ background: "linear-gradient(135deg,#059669,#047857)", boxShadow: "0 4px 16px rgba(5,150,105,0.4)" }}
                >
                  {adjusting ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Applying…
                    </div>
                  ) : (
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" /> Confirm Adjustment
                    </span>
                  )}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── History Dialog ─────────────────────────────── */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", paddingBottom: "1rem" }}>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl" style={{ background: "rgba(37,99,235,0.2)" }}>
                <History className="h-4 w-4 text-blue-400 m-auto mt-2.5" />
              </div>
              <div>
                <p className="font-bold text-base">Stock History</p>
                {historyProduct && (
                  <p className="text-xs text-muted-foreground font-normal mt-0.5 truncate max-w-[240px]">
                    {historyProduct.name}
                  </p>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2 mt-4 max-h-[340px] overflow-y-auto pr-1">
            {historyLoading ? (
              [1,2,3,4].map(i => <div key={i} className="h-14 skeleton rounded-xl" />)
            ) : stockMovements.length === 0 ? (
              <div className="text-center py-10 animate-fade-in">
                <History className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No movement history recorded.</p>
              </div>
            ) : (
              stockMovements.map(m => (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-3.5 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: m.quantity > 0 ? "rgba(5,150,105,0.15)" : "rgba(225,29,72,0.15)" }}
                    >
                      {m.quantity > 0
                        ? <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                        : <TrendingDown className="h-3.5 w-3.5 text-rose-400" />
                      }
                    </div>
                    <div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${
                        m.quantity > 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
                      }`}>
                        {m.movement_type}
                      </span>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(m.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  <span className={`font-bold font-mono text-base ${m.quantity > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {m.quantity > 0 ? "+" : ""}{m.quantity}
                  </span>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </RouteGuard>
  )
}
