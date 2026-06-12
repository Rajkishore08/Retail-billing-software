"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from "@/lib/supabase-client"
import { useAuth } from "@/contexts/auth-context"
import { User, Store, Settings as SettingsIcon, Image as ImageIcon, CheckCircle2, Building2, MapPin, Phone, Hash, Percent, Receipt, ScanLine, Printer, MonitorSmartphone, CalendarDays, X, UserCog, Shield, ArrowRight } from "lucide-react"
import { toast } from "sonner"
import { getStoreLogo, setStoreLogo, removeStoreLogo, getStoreQrImage, setStoreQrImage, removeStoreQrImage } from "@/lib/store-image-store"
import { RouteGuard } from "@/components/auth/route-guard"
import Link from "next/link"

export default function SettingsPage() {
  const { profile } = useAuth()
  const [storeSettings, setStoreSettings] = useState({
    store_name: "", store_address: "", store_phone: "", gst_number: "", default_gst_rate: "", receipt_footer: "", store_logo: "", upi_id: "",
  })
  const [profileData, setProfileData] = useState({ full_name: profile?.full_name || "", email: profile?.email || "", role: profile?.role || "cashier" })
  const [loading, setLoading] = useState(false)
  const [logoPreviewError, setLogoPreviewError] = useState(false)
  const [logoImage, setLogoImage] = useState<string>("")
  const [qrImage, setQrImage] = useState<string>("")

  const logoFileRef = useRef<HTMLInputElement>(null)
  const qrFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchSettings()
    setLogoImage(getStoreLogo() || storeSettings.store_logo || "")
    setQrImage(getStoreQrImage() || "")
  }, [])

  useEffect(() => {
    if (storeSettings.store_logo) {
      try { localStorage.setItem("store_logo", storeSettings.store_logo) } catch {}
    }
  }, [storeSettings.store_logo])
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

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast.error("Image must be under 2 MB"); return }
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      setStoreLogo(result)
      setLogoImage(result)
      toast.success("Logo uploaded successfully!")
    }
    reader.readAsDataURL(file)
  }

  const handleQrFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast.error("Image must be under 2 MB"); return }
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      setStoreQrImage(result)
      setQrImage(result)
      toast.success("QR code uploaded successfully!")
    }
    reader.readAsDataURL(file)
  }

  const updateSettings = async () => {
    setLoading(true)
    try {
      const entries = Object.entries(storeSettings).map(([key, value]) => ({ key, value }))
      for (const setting of entries) await supabase.from("settings").upsert(setting, { onConflict: "key" })
      if (logoImage) try { localStorage.setItem("store_logo", logoImage) } catch {}
      try { localStorage.setItem("store_name", storeSettings.store_name) } catch {}
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
    <RouteGuard module="settings">
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
            {/* ── Logo Section ── */}
            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <ImageIcon className="h-3 w-3" /> Store Logo
              </Label>
            </div>

            {/* Logo Upload Zone (click or drag) */}
            <div
              className="relative flex flex-col items-center justify-center h-36 bg-white/5 rounded-xl border-2 border-dashed border-white/15 cursor-pointer hover:border-purple-500/60 hover:bg-purple-500/5 transition-all duration-200 group overflow-hidden"
              onClick={() => logoFileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const file = e.dataTransfer.files?.[0]
                if (file) {
                  const fakeEvt = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>
                  handleLogoFile(fakeEvt)
                }
              }}
            >
              {logoImage && !logoPreviewError ? (
                <img src={logoImage} alt="Store Logo" className="h-full w-full object-contain p-3" onError={() => setLogoPreviewError(true)} />
              ) : (
                <div className="text-center text-muted-foreground select-none">
                  <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                    <ImageIcon className="h-6 w-6 text-purple-400 opacity-70" />
                  </div>
                  <p className="text-xs font-bold text-purple-300/70">Click or drag to upload logo</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">PNG, JPG, SVG · Max 2 MB</p>
                </div>
              )}
              {/* overlay hint on hover when image is present */}
              {logoImage && !logoPreviewError && (
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <p className="text-xs text-white font-bold">Click to replace</p>
                </div>
              )}
            </div>
            <input type="file" accept="image/*" ref={logoFileRef} onChange={handleLogoFile} className="hidden" />

            {/* Logo action row */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 rounded-xl border-border h-9 text-xs font-bold"
                onClick={() => logoFileRef.current?.click()}
              >
                <ImageIcon className="h-3 w-3 mr-1.5" /> Upload Image File
              </Button>
              {logoImage && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 w-9 p-0 rounded-xl border-red-500/30 hover:bg-red-500/10"
                  onClick={() => { removeStoreLogo(); setLogoImage(""); setStoreSettings({ ...storeSettings, store_logo: "" }); setLogoPreviewError(false) }}
                  title="Remove logo"
                >
                  <X className="h-3 w-3 text-red-400" />
                </Button>
              )}
            </div>

            {/* Logo URL fallback */}
            <div className="space-y-1.5">
              <Label htmlFor="store_logo" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Or paste image URL</Label>
              <Input
                id="store_logo"
                value={storeSettings.store_logo}
                onChange={(e) => {
                  setStoreSettings({ ...storeSettings, store_logo: e.target.value })
                  setLogoImage(e.target.value)
                  setLogoPreviewError(false)
                }}
                placeholder="https://example.com/logo.png"
                className="h-9 rounded-xl bg-background border-border text-xs"
              />
              <p className="text-[10px] text-muted-foreground">Paste a direct image URL (PNG, JPG, SVG).</p>
            </div>

            {/* ── UPI ID ── */}
            <div className="space-y-2 pt-1">
              <Label htmlFor="upi_id" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <ScanLine className="h-3 w-3" /> UPI ID for Receipts
              </Label>
              <Input id="upi_id" value={storeSettings.upi_id} onChange={(e) => setStoreSettings({ ...storeSettings, upi_id: e.target.value })} placeholder="yourstore@upi" className="h-11 rounded-xl bg-background border-border" />
              <p className="text-[10px] text-muted-foreground">This UPI ID will be shown as a QR code on printed receipts.</p>
            </div>

            {/* ── QR Code Section ── */}
            <div className="space-y-1 pt-1">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <ScanLine className="h-3 w-3" /> Custom QR Code Image
              </Label>
            </div>

            {/* QR Upload Zone */}
            <div
              className="relative flex flex-col items-center justify-center h-28 bg-white/5 rounded-xl border-2 border-dashed border-white/15 cursor-pointer hover:border-sky-500/60 hover:bg-sky-500/5 transition-all duration-200 group overflow-hidden"
              onClick={() => qrFileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const file = e.dataTransfer.files?.[0]
                if (file) {
                  const fakeEvt = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>
                  handleQrFile(fakeEvt)
                }
              }}
            >
              {qrImage ? (
                <img src={qrImage} alt="QR Code" className="h-full w-full object-contain p-2" />
              ) : (
                <div className="text-center text-muted-foreground select-none">
                  <div className="w-10 h-10 mx-auto mb-1.5 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center group-hover:bg-sky-500/20 transition-colors">
                    <ScanLine className="h-5 w-5 text-sky-400 opacity-70" />
                  </div>
                  <p className="text-xs font-bold text-sky-300/70">Click or drag to upload QR</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">PNG, JPG · Max 2 MB</p>
                </div>
              )}
              {qrImage && (
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <p className="text-xs text-white font-bold">Click to replace</p>
                </div>
              )}
            </div>
            <input type="file" accept="image/*" ref={qrFileRef} onChange={handleQrFile} className="hidden" />

            {/* QR action row */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 rounded-xl border-border h-9 text-xs font-bold"
                onClick={() => qrFileRef.current?.click()}
              >
                <ScanLine className="h-3 w-3 mr-1.5" /> Upload QR Image File
              </Button>
              {qrImage && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 w-9 p-0 rounded-xl border-red-500/30 hover:bg-red-500/10"
                  onClick={() => { removeStoreQrImage(); setQrImage("") }}
                  title="Remove QR"
                >
                  <X className="h-3 w-3 text-red-400" />
                </Button>
              )}
            </div>

            {/* QR URL fallback */}
            <div className="space-y-1.5">
              <Label htmlFor="qr_url" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Or paste QR image URL</Label>
              <Input
                id="qr_url"
                value={qrImage.startsWith("data:") ? "" : qrImage}
                onChange={(e) => {
                  const url = e.target.value
                  if (url) { setStoreQrImage(url); setQrImage(url) } else { removeStoreQrImage(); setQrImage("") }
                }}
                placeholder="https://example.com/qr-code.png"
                className="h-9 rounded-xl bg-background border-border text-xs"
              />
              <p className="text-[10px] text-muted-foreground">Paste a direct image URL for your QR code.</p>
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
              <Input id="store_name" value={storeSettings.store_name} onChange={(e) => setStoreSettings({ ...storeSettings, store_name: e.target.value })} placeholder="Techno Bills" className="h-11 rounded-xl bg-background border-border" />
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

      {/* ── Admin-Only Navigation Hub ────────────────────── */}
      {profile?.role === 'admin' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-violet-500/20 flex items-center justify-center">
              <Shield className="h-3.5 w-3.5 text-violet-400" />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Admin Controls</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              {
                href: "/settings/users",
                icon: UserCog,
                title: "User Management",
                desc: "Create, edit, activate/deactivate, and reset passwords for all system users.",
                gradient: "linear-gradient(135deg,#7c3aed,#5b21b6)",
                glow: "rgba(124,58,237,0.2)",
                border: "rgba(124,58,237,0.25)",
              },
              {
                href: "/settings/permissions",
                icon: Shield,
                title: "Permissions Matrix",
                desc: "Configure page-level access rights for Manager and Cashier roles.",
                gradient: "linear-gradient(135deg,#0284c7,#075985)",
                glow: "rgba(2,132,199,0.2)",
                border: "rgba(2,132,199,0.25)",
              },
            ].map((item) => (
              <Link key={item.href} href={item.href}>
                <div
                  className="group flex items-center gap-4 p-5 rounded-2xl border cursor-pointer hover:scale-[1.01] transition-all"
                  style={{ background: `${item.glow}`, borderColor: item.border }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-lg"
                    style={{ background: item.gradient }}
                  >
                    <item.icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
    </RouteGuard>
  )
}
