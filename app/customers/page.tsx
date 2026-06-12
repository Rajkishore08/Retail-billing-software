"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { supabase } from "@/lib/supabase-client"
import { useAuth } from "@/contexts/auth-context"
import {
  Users, Search, Plus, Edit, Trash2, Phone, Mail, MapPin,
  Gift, TrendingUp, Star, Award, CreditCard, IndianRupee,
  CheckCircle2, AlertTriangle, Clock, Crown, X
} from "lucide-react"
import { toast } from "sonner"
import { RouteGuard } from "@/components/auth/route-guard"

// ─── Types ─────────────────────────────────────────────────────────────────
type Customer = {
  id: string
  name: string
  phone: string
  email: string | null
  address: string | null
  date_of_birth: string | null
  loyalty_points: number
  total_spent: number
  visit_count: number
  last_visit: string | null
  outstanding_credit: number
  created_at: string
}

type CreditEntry = {
  id: string
  amount: number
  entry_type: string
  notes: string | null
  created_at: string
}

// ─── Helper Functions ──────────────────────────────────────────────────────
const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount)

const getLoyaltyTier = (points: number) => {
  if (points >= 500) return { name: "Platinum", gradient: "gradient-primary", glow: "glow-violet", text: "text-white", icon: Crown }
  if (points >= 200) return { name: "Gold", gradient: "gradient-amber", glow: "glow-amber", text: "text-white", icon: Star }
  if (points >= 50) return { name: "Silver", gradient: "gradient-sky", glow: "glow-sky", text: "text-white", icon: Award }
  return { name: "Bronze", gradient: "bg-slate-700", glow: "", text: "text-slate-200", icon: Gift }
}

const initials = (name: string) => name.split(/\s+/).map(w => w[0]).join("").slice(0,2).toUpperCase()

const placeholderClass = (name: string) => {
  const classes = ["img-placeholder-violet","img-placeholder-emerald","img-placeholder-amber","img-placeholder-sky","img-placeholder-rose"]
  return classes[(name.charCodeAt(0) || 0) % classes.length]
}

export default function CustomersPage() {
  const { profile } = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalLoyaltyPoints: 0,
    averageSpent: 0,
    totalOutstandingCredit: 0,
  })

  // Credit ledger dialog
  const [showCreditDialog, setShowCreditDialog] = useState(false)
  const [creditCustomer, setCreditCustomer] = useState<Customer | null>(null)
  const [creditEntries, setCreditEntries] = useState<CreditEntry[]>([])
  const [creditLoading, setCreditLoading] = useState(false)
  const [payAmount, setPayAmount] = useState("")
  const [payNotes, setPayNotes] = useState("")
  const [paying, setPaying] = useState(false)

  const [formData, setFormData] = useState({
    name: "", phone: "", email: "", address: "", date_of_birth: "",
  })

  useEffect(() => { fetchCustomers() }, [])

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) throw error
      const rows = data || []
      setCustomers(rows)

      setStats({
        totalCustomers: rows.length,
        totalLoyaltyPoints: rows.reduce((s, c) => s + (c.loyalty_points || 0), 0),
        averageSpent: rows.length > 0 ? rows.reduce((s, c) => s + (c.total_spent || 0), 0) / rows.length : 0,
        totalOutstandingCredit: rows.reduce((s, c) => s + (c.outstanding_credit || 0), 0),
      })
    } catch {
      toast.error("Failed to load customers")
    } finally {
      setLoading(false)
    }
  }

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm) ||
      (c.email || "").toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const resetForm = () => {
    setFormData({ name: "", phone: "", email: "", address: "", date_of_birth: "" })
    setEditingCustomer(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim() || !formData.phone.trim()) { toast.error("Name & Phone required"); return }

    setSaving(true)
    try {
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim() || null,
        address: formData.address.trim() || null,
        date_of_birth: formData.date_of_birth || null,
      }

      const p2 = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim() || null,
      }

      const upsert = async (data: any) => editingCustomer
        ? supabase.from("customers").update(data).eq("id", editingCustomer.id)
        : supabase.from("customers").insert(data)

      let { error } = await upsert(payload)
      if (error && (error.code === "42703" || error.message?.includes("column"))) {
        const retry = await upsert(p2)
        error = retry.error
      }

      if (error) throw error
      
      toast.success(editingCustomer ? "Customer updated!" : "Customer added!")
      setShowAddDialog(false)
      resetForm()
      fetchCustomers()
    } catch (err: any) {
      toast.error(err.code === "23505" ? "Phone number already exists" : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete customer?")) return
    const { error } = await supabase.from("customers").delete().eq("id", id)
    if (error) toast.error("Failed to delete")
    else { toast.success("Customer deleted"); fetchCustomers() }
  }

  // ── Credit Ledger ──────────────────────────────────────────────────
  const openCreditDialog = async (customer: Customer) => {
    setCreditCustomer(customer)
    setShowCreditDialog(true)
    setPayAmount("")
    setPayNotes("")
    setCreditLoading(true)
    try {
      const { data } = await supabase
        .from("credit_ledger")
        .select("*")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })
        .limit(30)
      setCreditEntries(data || [])
    } finally { setCreditLoading(false) }
  }

  const handleMarkPayment = async () => {
    if (!creditCustomer || !payAmount || isNaN(parseFloat(payAmount))) return
    const amt = parseFloat(payAmount)
    if (amt <= 0 || amt > (creditCustomer.outstanding_credit || 0)) { toast.error("Invalid amount"); return }

    setPaying(true)
    try {
      await supabase.from("credit_ledger").insert({
        customer_id: creditCustomer.id,
        amount: -amt,
        entry_type: "payment_received",
        notes: payNotes || null,
        created_by: profile?.id || null,
      })

      const newCredit = Math.max(0, (creditCustomer.outstanding_credit || 0) - amt)
      await supabase.from("customers").update({ outstanding_credit: newCredit }).eq("id", creditCustomer.id)

      toast.success("Payment recorded!")
      setPayAmount("")
      setPayNotes("")
      fetchCustomers()
      openCreditDialog({ ...creditCustomer, outstanding_credit: newCredit })
    } catch { toast.error("Payment failed") }
    finally { setPaying(false) }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-9 skeleton w-48 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          {[1,2,3,4].map(i => <div key={i} className="h-28 skeleton rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-48 skeleton rounded-2xl" />)}
        </div>
      </div>
    )
  }

  return (
    <RouteGuard module="customers">
    <div className="space-y-6 animate-fade-in-up">
      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your store's relationships, loyalty, and credit.
          </p>
        </div>
        <Button
          onClick={() => { resetForm(); setShowAddDialog(true) }}
          className="h-10 px-5 rounded-xl font-semibold gradient-sky border-0 shadow-md hover:opacity-90 glow-sky text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Customer
        </Button>
      </div>

      {/* ── Stats Cards ───────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: "Total Customers", val: stats.totalCustomers, icon: Users, color: "#38bdf8", bg: "rgba(2,132,199,0.15)", glow: "glow-sky" },
          { label: "Loyalty Points", val: stats.totalLoyaltyPoints, icon: Gift, color: "#a78bfa", bg: "rgba(124,58,237,0.15)", glow: "glow-violet" },
          { label: "Avg Spent", val: formatCurrency(stats.averageSpent), icon: TrendingUp, color: "#34d399", bg: "rgba(5,150,105,0.15)", glow: "glow-emerald" },
          { label: "Credit Due", val: formatCurrency(stats.totalOutstandingCredit), icon: CreditCard, color: "#fb7185", bg: "rgba(225,29,72,0.15)", glow: stats.totalOutstandingCredit > 0 ? "glow-rose" : "" },
        ].map((s, i) => (
          <Card key={i} className={`border-0 overflow-hidden card-hover stagger-${i+1} ${s.glow}`} style={{ background: "rgba(255,255,255,0.03)" }}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: s.bg }}>
                <s.icon className="h-6 w-6" style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk',sans-serif", color: s.color }}>{s.val}</p>
                <p className="text-sm font-medium text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Search ────────────────────────────────────────── */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone, or email…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 h-11 rounded-xl bg-card border-border"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Customers Grid ────────────────────────────────── */}
      {filteredCustomers.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-2xl border border-border">
          <Users className="h-14 w-14 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold">No customers found</h3>
          <p className="text-muted-foreground text-sm mb-6">Add your first customer to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredCustomers.map((customer, i) => {
            const tier = getLoyaltyTier(customer.loyalty_points || 0)
            const TierIcon = tier.icon
            const hasCredit = (customer.outstanding_credit || 0) > 0

            return (
              <Card key={customer.id} className="border-border bg-card rounded-2xl overflow-hidden card-hover" style={{ animationDelay: `${i*0.05}s` }}>
                <CardContent className="p-0">
                  {/* Top Banner */}
                  <div className={`h-16 w-full ${placeholderClass(customer.name)} opacity-80 relative`} />
                  
                  <div className="px-5 pb-5">
                    {/* Avatar & Actions */}
                    <div className="flex justify-between items-start -mt-8 mb-3">
                      <div className={`w-16 h-16 rounded-xl ${placeholderClass(customer.name)} shadow-lg border-2 border-background flex items-center justify-center text-xl font-bold text-white`}>
                        {initials(customer.name)}
                      </div>
                      <div className="flex gap-1.5 mt-9">
                        <Button size="icon" variant="ghost" onClick={() => { setEditingCustomer(customer); setFormData({name:customer.name, phone:customer.phone, email:customer.email||"", address:customer.address||"", date_of_birth:customer.date_of_birth||""}); setShowAddDialog(true) }} className="h-7 w-7 rounded-lg text-slate-400 hover:text-white bg-white/5">
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(customer.id)} className="h-7 w-7 rounded-lg text-slate-400 hover:text-rose-400 bg-white/5">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Name & Tier */}
                    <div className="mb-4">
                      <h3 className="font-bold text-lg leading-tight truncate">{customer.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${tier.gradient} ${tier.text}`}>
                          <TierIcon className="h-2.5 w-2.5" /> {tier.name}
                        </span>
                        {hasCredit && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500 text-white shadow-lg shadow-rose-500/20">
                            <AlertTriangle className="h-2.5 w-2.5" /> Credit Due
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-1.5 mb-5 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 shrink-0" />{customer.phone}</div>
                      {customer.email && <div className="flex items-center gap-2 truncate"><Mail className="h-3.5 w-3.5 shrink-0" />{customer.email}</div>}
                    </div>

                    {/* Mini Stats Grid */}
                    <div className="grid grid-cols-2 gap-3 mb-5 p-3 rounded-xl bg-white/5 border border-white/5">
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Points</p>
                        <p className="font-semibold text-violet-400">{customer.loyalty_points || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Spent</p>
                        <p className="font-semibold text-emerald-400">{formatCurrency(customer.total_spent || 0)}</p>
                      </div>
                    </div>

                    {/* Credit Button */}
                    <Button 
                      onClick={() => openCreditDialog(customer)}
                      variant={hasCredit ? "destructive" : "secondary"}
                      className={`w-full h-9 text-xs rounded-xl font-bold ${hasCredit ? "bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30" : ""}`}
                    >
                      <CreditCard className="h-3.5 w-3.5 mr-2" />
                      {hasCredit ? `Pay ${formatCurrency(customer.outstanding_credit)}` : "Credit Ledger"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ── Add / Edit Dialog ─────────────────────────────── */}
      <Dialog open={showAddDialog} onOpenChange={v => { setShowAddDialog(v); if(!v) resetForm() }}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? "Edit Customer" : "New Customer"}</DialogTitle>
            <DialogDescription>Customer details and loyalty info.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="h-10 rounded-xl bg-card border-border" required />
            </div>
            <div className="space-y-1.5">
              <Label>Phone Number *</Label>
              <Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="h-10 rounded-xl bg-card border-border" required />
            </div>
            <div className="space-y-1.5">
              <Label>Email (Optional)</Label>
              <Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="h-10 rounded-xl bg-card border-border" />
            </div>
            <div className="space-y-1.5">
              <Label>Address (Optional)</Label>
              <Textarea value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="rounded-xl bg-card border-border" rows={2} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving} className="flex-1 gradient-sky border-0 rounded-xl font-bold shadow-lg glow-sky">{saving ? "Saving..." : "Save Customer"}</Button>
              <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)} className="flex-1 rounded-xl font-bold">Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Credit Ledger Dialog ──────────────────────────── */}
      <Dialog open={showCreditDialog} onOpenChange={setShowCreditDialog}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-rose-500" />
              {creditCustomer?.name}'s Ledger
            </DialogTitle>
          </DialogHeader>

          {creditCustomer && (
            <div className={`p-4 rounded-xl text-center border ${(creditCustomer.outstanding_credit || 0) > 0 ? "bg-rose-500/10 border-rose-500/20" : "bg-emerald-500/10 border-emerald-500/20"}`}>
              <p className={`text-3xl font-bold font-mono ${(creditCustomer.outstanding_credit || 0) > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                {formatCurrency(customers.find(c => c.id === creditCustomer.id)?.outstanding_credit || creditCustomer.outstanding_credit || 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Outstanding Balance</p>
            </div>
          )}

          {(customers.find(c => c.id === creditCustomer?.id)?.outstanding_credit || 0) > 0 && (
            <div className="space-y-3 mt-4">
              <Label className="font-bold flex items-center gap-1.5 text-emerald-400"><CheckCircle2 className="h-4 w-4" /> Record Payment</Label>
              <div className="flex gap-2">
                <Input type="number" placeholder="Amount (₹)" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="h-10 flex-1 rounded-xl bg-card border-border" />
                <Button onClick={handleMarkPayment} disabled={paying} className="h-10 rounded-xl gradient-emerald border-0 shadow-lg glow-emerald font-bold">Pay</Button>
              </div>
              <Input placeholder="Notes (optional)" value={payNotes} onChange={e => setPayNotes(e.target.value)} className="h-9 text-sm rounded-xl bg-card border-border" />
            </div>
          )}

          <Separator className="my-4 border-white/5" />

          <div className="space-y-3">
            <Label className="font-bold text-sm">Transaction History</Label>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              {creditEntries.map(e => (
                <div key={e.id} className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/5">
                  <div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${e.amount < 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}>
                      {e.entry_type.replace("_", " ").toUpperCase()}
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-1">{new Date(e.created_at).toLocaleDateString("en-IN")}</p>
                  </div>
                  <span className={`font-bold font-mono text-sm ${e.amount < 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {e.amount < 0 ? "-" : "+"}₹{Math.abs(e.amount).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </RouteGuard>
  )
}
