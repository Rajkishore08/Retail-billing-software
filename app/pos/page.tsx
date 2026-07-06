"use client"

import { POSInterface } from "@/components/pos/pos-interface"
import { RouteGuard } from "@/components/auth/route-guard"

export default function POSPage() {
  return (
    <RouteGuard module="pos">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">POS Billing</h1>
            <p className="text-muted-foreground">Process sales and manage transactions</p>
          </div>
        </div>

        <POSInterface />
      </div>
    </RouteGuard>
  )
}
