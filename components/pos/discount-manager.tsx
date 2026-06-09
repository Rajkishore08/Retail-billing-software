"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Percent, DollarSign, X } from "lucide-react"

type DiscountType = "percentage" | "amount"

interface DiscountManagerProps {
  subtotal: number
  onDiscountChange: (discountAmount: number, discountPercentage: number) => void
  discountAmount: number
  discountPercentage: number
}

export function DiscountManager({ 
  subtotal, 
  onDiscountChange, 
  discountAmount, 
  discountPercentage 
}: DiscountManagerProps) {
  const [discountType, setDiscountType] = useState<DiscountType>("percentage")
  const [discountValue, setDiscountValue] = useState("")

  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount)
  }, [])

  const handleDiscountApply = useCallback(() => {
    const value = parseFloat(discountValue)
    if (isNaN(value) || value < 0) return

    if (discountType === "percentage") {
      if (value > 100) return // Max 100% discount
      const amount = (subtotal * value) / 100
      onDiscountChange(amount, value)
    } else {
      if (value > subtotal) return // Max discount cannot exceed subtotal
      const percentage = (value / subtotal) * 100
      onDiscountChange(value, percentage)
    }
    
    setDiscountValue("")
  }, [discountValue, discountType, subtotal, onDiscountChange])

  const handleDiscountClear = useCallback(() => {
    onDiscountChange(0, 0)
    setDiscountValue("")
  }, [onDiscountChange])

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleDiscountApply()
    }
  }, [handleDiscountApply])

  const savingsAmount = discountAmount
  const savingsPercentage = discountPercentage

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Percent className="h-5 w-5 text-green-600" />
          <span>Discount & Savings</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Discount Type Selection */}
        <div className="flex space-x-2">
          <Button
            variant={discountType === "percentage" ? "default" : "outline"}
            size="sm"
            onClick={() => setDiscountType("percentage")}
            className="flex-1"
          >
            <Percent className="h-4 w-4 mr-1" />
            Percentage
          </Button>
          <Button
            variant={discountType === "amount" ? "default" : "outline"}
            size="sm"
            onClick={() => setDiscountType("amount")}
            className="flex-1"
          >
            <DollarSign className="h-4 w-4 mr-1" />
            Amount
          </Button>
        </div>

        {/* Discount Input */}
        <div className="space-y-2">
          <Label htmlFor="discount-value">
            {discountType === "percentage" ? "Discount Percentage" : "Discount Amount"}
          </Label>
          <div className="flex space-x-2">
            <Input
              id="discount-value"
              type="number"
              placeholder={discountType === "percentage" ? "10" : "100"}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
              min="0"
              max={discountType === "percentage" ? "100" : subtotal.toString()}
              step={discountType === "percentage" ? "0.01" : "0.01"}
            />
            <Button onClick={handleDiscountApply} size="sm">
              Apply
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {discountType === "percentage" 
              ? `Max: 100% (₹${formatCurrency(subtotal)})`
              : `Max: ₹${formatCurrency(subtotal)}`
            }
          </p>
        </div>

        {/* Current Discount Display */}
        {(discountAmount > 0 || discountPercentage > 0) && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Applied Discount:</span>
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary" className="text-green-600">
                    {discountPercentage.toFixed(2)}%
                  </Badge>
                  <span className="font-bold text-green-600">
                    -{formatCurrency(discountAmount)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDiscountClear}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              
              {/* Savings Information */}
              <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">
                    Customer Savings:
                  </span>
                  <span className="text-lg font-bold text-green-600">
                    {formatCurrency(savingsAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-green-600">
                    Savings Percentage:
                  </span>
                  <span className="text-sm font-semibold text-green-600">
                    {savingsPercentage.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Quick Discount Buttons */}
        <Separator />
        <div className="space-y-2">
          <Label className="text-sm font-medium">Quick Discounts:</Label>
          <div className="grid grid-cols-3 gap-2">
            {[5, 10, 15, 20, 25, 30].map((percent) => (
              <Button
                key={percent}
                variant="outline"
                size="sm"
                onClick={() => {
                  const amount = (subtotal * percent) / 100
                  onDiscountChange(amount, percent)
                }}
                className="text-xs"
              >
                {percent}%
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 