"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Gift, Coins, Info } from "lucide-react"
import { toast } from "sonner"

type Customer = {
  id: string
  name: string
  phone: string
  email: string | null
  loyalty_points: number
  total_spent: number
}

type LoyaltyRedemptionProps = {
  customer: Customer | null
  totalAmount: number
  onLoyaltyApplied: (pointsRedeemed: number, discountAmount: number) => void
  loyaltyPointsRedeemed: number
  loyaltyDiscountAmount: number
}

export function LoyaltyRedemption({ 
  customer, 
  totalAmount, 
  onLoyaltyApplied, 
  loyaltyPointsRedeemed, 
  loyaltyDiscountAmount 
}: LoyaltyRedemptionProps) {
  const [showDialog, setShowDialog] = useState(false)
  const [pointsToRedeem, setPointsToRedeem] = useState("")
  const [maxRedeemablePoints, setMaxRedeemablePoints] = useState(0)
  const [maxDiscountAmount, setMaxDiscountAmount] = useState(0)

  useEffect(() => {
    if (customer) {
      // Calculate max redeemable points (minimum 100 points required)
      const availablePoints = customer.loyalty_points
      const maxPoints = Math.floor(availablePoints / 100) * 100 // Only redeem in multiples of 100
      setMaxRedeemablePoints(maxPoints)
      
      // Calculate max discount amount (1 point = ₹5)
      const maxDiscount = maxPoints * 5 // Fixed: 5 rupees per point
      setMaxDiscountAmount(maxDiscount)
    }
  }, [customer])

  const handleRedeemPoints = () => {
    if (!customer) return

    const points = parseInt(pointsToRedeem)
    if (isNaN(points) || points <= 0) {
      toast.error("Please enter a valid number of points")
      return
    }

    if (points > maxRedeemablePoints) {
      toast.error(`You can only redeem up to ${maxRedeemablePoints} points`)
      return
    }

    if (points < 100) {
      toast.error("Minimum 100 points required for redemption")
      return
    }

    if (points % 100 !== 0) {
      toast.error("Points must be redeemed in multiples of 100")
      return
    }

    const discountAmount = points * 5 // Fixed: 5 rupees per point
    if (discountAmount > totalAmount) {
      toast.error("Discount amount cannot exceed total amount")
      return
    }

    onLoyaltyApplied(points, discountAmount)
    setShowDialog(false)
    setPointsToRedeem("")
    toast.success(`Redeemed ${points} points for ₹${discountAmount.toFixed(2)} discount`)
  }

  const handleRemoveLoyalty = () => {
    onLoyaltyApplied(0, 0)
    toast.success("Loyalty discount removed")
  }

  if (!customer) {
    return null
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Gift className="h-4 w-4" />
            Loyalty Points
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm">Available Points:</span>
            <Badge variant="secondary" className="text-xs">
              {customer.loyalty_points} pts
            </Badge>
          </div>
          
          {customer.loyalty_points >= 100 && (
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex items-center gap-1">
                <Info className="h-3 w-3" />
                <span>1 point = ₹5 discount</span>
              </div>
              <div className="flex items-center gap-1">
                <Coins className="h-3 w-3" />
                <span>Max redeemable: {maxRedeemablePoints} points (₹{maxDiscountAmount.toFixed(2)})</span>
              </div>
            </div>
          )}

          {loyaltyPointsRedeemed > 0 ? (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Points Redeemed:</span>
                <span className="text-green-600 font-medium">{loyaltyPointsRedeemed} pts</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Discount Applied:</span>
                <span className="text-green-600 font-medium">-₹{loyaltyDiscountAmount.toFixed(2)}</span>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRemoveLoyalty}
                className="w-full"
              >
                Remove Loyalty Discount
              </Button>
            </div>
          ) : (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowDialog(true)}
              disabled={customer.loyalty_points < 100}
              className="w-full"
            >
              {customer.loyalty_points >= 100 ? "Redeem Points" : "Need 100+ points"}
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redeem Loyalty Points</DialogTitle>
            <DialogDescription>
              Redeem your loyalty points for discounts. 1 point = ₹5 discount.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="points">Points to Redeem (multiples of 100)</Label>
              <Input
                id="points"
                type="number"
                value={pointsToRedeem}
                onChange={(e) => setPointsToRedeem(e.target.value)}
                placeholder={`Max: ${maxRedeemablePoints}`}
                min="100"
                max={maxRedeemablePoints}
                step="100"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Available Points:</span>
                <span>{customer.loyalty_points}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Max Redeemable:</span>
                <span>{maxRedeemablePoints}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Discount Amount:</span>
                <span className="text-green-600 font-medium">
                  ₹{pointsToRedeem ? (parseInt(pointsToRedeem) * 5).toFixed(2) : "0.00"}
                </span>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={handleRedeemPoints}
                disabled={!pointsToRedeem || parseInt(pointsToRedeem) < 100}
                className="flex-1"
              >
                Apply Discount
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
} 