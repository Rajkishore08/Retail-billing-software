"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from "@/lib/supabase-client"
import { useAuth } from "@/contexts/auth-context"
import { User, Store, Settings as SettingsIcon, Image as ImageIcon, CheckCircle2, Building2, MapPin, Phone, Hash, Percent, Receipt, ScanLine, Printer, MonitorSmartphone, CalendarDays } from "lucide-react"
import { toast } from "sonner"

export default function SettingsPage() {
  const { profile } = useAuth()
  const [storeSettings, setStoreSettings] = useState({
    store_name: "", store_address: "", store_phone: "", gst_number: "", default_gst_rate: "", receipt_footer: "", store_logo: "", upi_id: "",
  })
  const [profileData, setProfileData] = useState({ full_name: profile?.full_name || "", email: profile?.email || "", role: profile?.role || "cashier" })
  const [loading, setLoading] = useState(false)
  const [logoPreviewError, setLogoPreviewError] = useState(false)

  useEffect(() => { fetchSettings() }, [])
  useEffect(() => { if (profile) setProfileData({ full_name: profile.full_name || "", email: profile.email || "", role: profile.role || "cashier" }) }, [profile])

  const fetchSettings = async () => {
    const { data, error } = await supabase.from("settings").select("key, value")
    if (!error && data) {
      const settings = data.reduce((acc, s) => { acc[s.key] = s.value; return acc }, {} as Record<string, string>)
      setStoreSettings({
        store_name: settings.store_name || "", store_address: settings.store_address || "", store_phone: settings.store_phone || "",
        gst_number: settings.gst_number || "", default_gst_rate: settings.default_gst_rate || "", receipt_footer: settings.receipt_footer || "",
        store_logo: settings.store_logo || "", upi_id: settings.upi_id || "",
      })
      if (settings.store_logo) try { localStorage.setItem("store_logo", settings.store_logo) } catch {}
      if (settings.store_name) try { localStorage.setItem("store_name", settings.store_name) } catch {}
    }
  }

  const updateSettings = async () => {
    setLoading(true)
    try {
      const entries = Object.entries(storeSettings).map(([key, value]) => ({ key, value }))
      for (const setting of entries) await supabase.from("settings").upsert(setting, { onConflict: "key" })
      try { localStorage.setItem("store_logo", storeSettings.store_logo); localStorage.setItem("store_name", storeSettings.store_name) } catch {}
      toast.success("Settings saved successfully!")
    } catch { toast.error("Error saving settings") } finally { setLoading(false) }
  }

  const updateProfile = async () => {
    setLoading(true)
    try {
      const { error } = await supabase.from("profiles").update({ full_name: profileData.full_name, role: profileData.role }).eq("id", profile?.id)
      if (error) throw error
      toast.success("Profile updated successfully!")
    } catch { toast.error("Error updating profile") } finally { setLoading(false) }
  }

  return (
    <div className="space-y-6 max-w-5xl animate-fade-in-up pb-10">
      {/* ── Header ────────────────────────────────────────── */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your account, store, and system preferences.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── User Profile ─────────────────────────────────── */}
        <Card className="border-border bg-card rounded-2xl overflow-hidden card-hover stagger-1">
          <div className="p-5 border-b border-white/5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
              <User className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold">User Profile</h3>
              <p className="text-xs text-muted-foreground">Update your personal information and role.</p>
            </div>
          </div>
          <CardContent className="p-5 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="full_name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Full Name</Label>
              <Input id="full_name" value={profileData.full_name} onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })} placeholder="Your full name" className="h-11 rounded-xl bg-background border-border" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email Address</Label>
              <Input id="email" value={profileData.email} disabled className="h-11 rounded-xl bg-white/5 border-border opacity-50" />
              <p className="text-[10px] text-muted-foreground">Email cannot be changed here.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">System Role</Label>
              <Select value={profileData.role} onValueChange={(value) => setProfileData({ ...profileData, role: value as any })}>
                <SelectTrigger className="h-11 rounded-xl bg-background border-border"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="cashier">Cashier</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={updateProfile} disabled={loading} className="w-full h-11 rounded-xl gradient-primary border-0 shadow-lg glow-violet text-white font-bold mt-2">
              <CheckCircle2 className="h-4 w-4 mr-2" /> Save Profile
            </Button>
          </CardContent>
        </Card>

        {/* ── Store Logo ──────────────────────────────────── */}
        <Card className="border-border bg-card rounded-2xl overflow-hidden card-hover stagger-2">
          <div className="p-5 border-b border-white/5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
              <ImageIcon className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h3 className="font-bold">Branding & Logo</h3>
              <p className="text-xs text-muted-foreground">Add your store logo and payment details.</p>
            </div>
          </div>
          <CardContent className="p-5 space-y-5">
            <div className="flex flex-col items-center justify-center h-32 bg-white/5 rounded-xl border border-dashed border-white/10 relative overflow-hidden">
              {storeSettings.store_logo && !logoPreviewError ? (
                <img src={storeSettings.store_logo} alt="Store Logo" className="h-full w-full object-contain p-2" onError={() => setLogoPreviewError(true)} />
              ) : (
                <div className="text-center text-muted-foreground">
                  <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-[10px] uppercase tracking-wider font-bold">Logo Preview</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="store_logo" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Logo URL</Label>
              <Input id="store_logo" value={storeSettings.store_logo} onChange={(e) => { setStoreSettings({ ...storeSettings, store_logo: e.target.value }); setLogoPreviewError(false) }} placeholder="https://example.com/your-logo.png" className="h-11 rounded-xl bg-background border-border" />
              <p className="text-[10px] text-muted-foreground">Paste a direct image URL (PNG, JPG, SVG).</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="upi_id" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><ScanLine className="h-3 w-3" /> UPI ID for Receipts</Label>
              <Input id="upi_id" value={storeSettings.upi_id} onChange={(e) => setStoreSettings({ ...storeSettings, upi_id: e.target.value })} placeholder="yourstore@upi" className="h-11 rounded-xl bg-background border-border" />
              <p className="text-[10px] text-muted-foreground">This UPI ID will be shown as a QR code on printed receipts.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Store Information ─────────────────────────────── */}
      <Card className="border-border bg-card rounded-2xl overflow-hidden card-hover stagger-3">
        <div className="p-5 border-b border-white/5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
            <Store className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-bold">Store Information</h3>
            <p className="text-xs text-muted-foreground">Manage your store's details for invoices and records.</p>
          </div>
        </div>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="store_name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Building2 className="h-3 w-3" /> Store Name</Label>
              <Input id="store_name" value={storeSettings.store_name} onChange={(e) => setStoreSettings({ ...storeSettings, store_name: e.target.value })} placeholder="National Mini Mart" className="h-11 rounded-xl bg-background border-border" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="store_phone" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> Phone Number</Label>
              <Input id="store_phone" value={storeSettings.store_phone} onChange={(e) => setStoreSettings({ ...storeSettings, store_phone: e.target.value })} placeholder="+91 98765 43210" className="h-11 rounded-xl bg-background border-border" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="store_address" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Store Address</Label>
              <Input id="store_address" value={storeSettings.store_address} onChange={(e) => setStoreSettings({ ...storeSettings, store_address: e.target.value })} placeholder="123, Main Street, Your City - 600001" className="h-11 rounded-xl bg-background border-border" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gst_number" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Hash className="h-3 w-3" /> GST Number</Label>
              <Input id="gst_number" value={storeSettings.gst_number} onChange={(e) => setStoreSettings({ ...storeSettings, gst_number: e.target.value })} placeholder="22AAAAA0000A1Z5" className="h-11 rounded-xl bg-background border-border uppercase" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="default_gst_rate" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Percent className="h-3 w-3" /> Default GST Rate (%)</Label>
              <Input id="default_gst_rate" type="number" step="0.01" value={storeSettings.default_gst_rate} onChange={(e) => setStoreSettings({ ...storeSettings, default_gst_rate: e.target.value })} placeholder="18" className="h-11 rounded-xl bg-background border-border" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="receipt_footer" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Receipt className="h-3 w-3" /> Receipt Footer Message</Label>
              <Input id="receipt_footer" value={storeSettings.receipt_footer} onChange={(e) => setStoreSettings({ ...storeSettings, receipt_footer: e.target.value })} placeholder="Thank you for shopping with us! Visit again." className="h-11 rounded-xl bg-background border-border" />
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={updateSettings} disabled={loading} className="h-11 px-8 rounded-xl gradient-emerald border-0 shadow-lg glow-emerald text-white font-bold w-full md:w-auto">
              <CheckCircle2 className="h-4 w-4 mr-2" /> Save Store Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── System Settings ───────────────────────────────── */}
      <Card className="border-border bg-card rounded-2xl overflow-hidden card-hover stagger-4">
        <div className="p-5 border-b border-white/5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0">
            <SettingsIcon className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <h3 className="font-bold">System Settings</h3>
            <p className="text-xs text-muted-foreground">Configure system preferences and display options.</p>
          </div>
        </div>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-5">
              <h4 className="text-sm font-bold text-orange-400 flex items-center gap-2"><Printer className="h-4 w-4" /> Printer Settings</h4>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Receipt Width</Label>
                <Select defaultValue="3inch">
                  <SelectTrigger className="h-11 rounded-xl bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="3inch">3 inch (80mm) Thermal</SelectItem>
                    <SelectItem value="2inch">2 inch (58mm) Thermal</SelectItem>
                    <SelectItem value="a4">A4 Paper</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-5">
              <h4 className="text-sm font-bold text-sky-400 flex items-center gap-2"><MonitorSmartphone className="h-4 w-4" /> Display Settings</h4>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Currency Format</Label>
                <Select defaultValue="inr">
                  <SelectTrigger className="h-11 rounded-xl bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="inr">Indian Rupee (₹)</SelectItem>
                    <SelectItem value="usd">US Dollar ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Date Format</Label>
                <Select defaultValue="dd/mm/yyyy">
                  <SelectTrigger className="h-11 rounded-xl bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="dd/mm/yyyy">DD/MM/YYYY</SelectItem>
                    <SelectItem value="mm/dd/yyyy">MM/DD/YYYY</SelectItem>
                    <SelectItem value="yyyy-mm-dd">YYYY-MM-DD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
