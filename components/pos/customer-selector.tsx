"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { User, Search, Gift } from "lucide-react"
import { supabase } from "@/lib/supabase-client"

type Customer = {
  id: string
  name: string
  phone: string
  email: string | null
  loyalty_points: number
  total_spent: number
}

type CustomerSelectorProps = {
  selectedCustomer: Customer | null
  onCustomerSelect: (customer: Customer | null) => void
}

export function CustomerSelector({ selectedCustomer, onCustomerSelect }: CustomerSelectorProps) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [showDialog, setShowDialog] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (showDialog) {
      fetchCustomers()
    }
  }, [showDialog])

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase.from("customers").select("*").order("name")

      if (error) throw error

      setCustomers(data || [])
    } catch (error) {
      console.error("Error fetching customers:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone.includes(searchTerm) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const handleCustomerSelect = (customer: Customer) => {
    onCustomerSelect(customer)
    setShowDialog(false)
    setSearchTerm("")
  }

  const clearCustomer = () => {
    onCustomerSelect(null)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Customer</span>
        {selectedCustomer && (
          <Button variant="ghost" size="sm" onClick={clearCustomer}>
            Clear
          </Button>
        )}
      </div>

      {selectedCustomer ? (
        <Card className="bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span className="font-medium">{selectedCustomer.name}</span>
                </div>
                <div className="text-sm text-gray-600">{selectedCustomer.phone}</div>
                <div className="flex items-center gap-2 mt-1">
                  <Gift className="h-3 w-3 text-purple-600" />
                  <span className="text-sm text-purple-600">{selectedCustomer.loyalty_points} points</span>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowDialog(true)}>
                Change
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full justify-start bg-transparent">
              <User className="h-4 w-4 mr-2" />
              Select Customer (Optional)
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
                    <DialogHeader>
          <DialogTitle>Select Customer</DialogTitle>
          <DialogDescription>
            Choose a customer for this transaction
          </DialogDescription>
        </DialogHeader>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search customers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <ScrollArea className="h-64">
                {loading ? (
                  <div className="text-center py-4">Loading customers...</div>
                ) : filteredCustomers.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    {searchTerm ? "No customers found" : "No customers available"}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredCustomers.map((customer) => (
                      <Card
                        key={customer.id}
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => handleCustomerSelect(customer)}
                      >
                        <CardContent className="p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium">{customer.name}</div>
                              <div className="text-sm text-gray-600">{customer.phone}</div>
                              {customer.email && <div className="text-sm text-gray-600">{customer.email}</div>}
                            </div>
                            <div className="text-right">
                              <Badge variant="secondary" className="text-xs">
                                {customer.loyalty_points} pts
                              </Badge>
                              <div className="text-xs text-gray-500 mt-1">₹{customer.total_spent.toFixed(0)} spent</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>

              <Button
                variant="outline"
                className="w-full bg-transparent"
                onClick={() => {
                  setShowDialog(false)
                  setSearchTerm("")
                }}
              >
                Continue without customer
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
