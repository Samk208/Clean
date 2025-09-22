"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useCartStore } from "@/lib/store/cart"
import {
  ShoppingCart,
  Plus,
  Minus,
  X,
  ArrowLeft,
  Shield,
  Truck,
  RotateCcw,
  AlertCircle,
  CheckCircle,
  Trash2
} from "lucide-react"
import { cn } from "@/lib/utils"

export function CartSidebar() {
  const {
    items,
    getTotalItems,
    getTotalPrice,
    getSubtotal,
    getTax,
    getShipping,
    updateQuantity,
    removeItem,
    clearCart
  } = useCartStore()

  const [orderNote, setOrderNote] = useState("")

  const handleProceedToCheckout = async () => {
    // Redirect to checkout page
    window.location.href = '/checkout'
  }

  const outOfStockItems = items.filter(item => item.maxQuantity === 0)
  const inStockItems = items.filter(item => item.maxQuantity > 0)

  if (items.length === 0) {
    return <EmptyCart />
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          <h2 className="font-semibold">Shopping Cart</h2>
          <Badge variant="secondary">{getTotalItems()}</Badge>
        </div>
        {items.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearCart}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* In Stock Items */}
        {inStockItems.length > 0 && (
          <div className="space-y-4">
            {inStockItems.map((item) => (
              <CartItem 
                key={item.id} 
                item={item} 
                onUpdateQuantity={updateQuantity}
                onRemove={removeItem}
              />
            ))}
          </div>
        )}

        {/* Out of Stock Items */}
        {outOfStockItems.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium text-sm">Out of Stock Items</span>
            </div>
            {outOfStockItems.map((item) => (
              <CartItem 
                key={item.id} 
                item={item} 
                onUpdateQuantity={updateQuantity}
                onRemove={removeItem}
                disabled
              />
            ))}
          </div>
        )}

        {/* Order Note */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Order Note (Optional)
          </label>
          <Textarea
            placeholder="Add any special instructions..."
            value={orderNote}
            onChange={(e) => setOrderNote(e.target.value)}
            className="min-h-[80px]"
            maxLength={500}
          />
          <p className="text-xs text-gray-500">{orderNote.length}/500</p>
        </div>
      </div>

      {/* Order Summary */}
      <div className="border-t p-4 space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Subtotal ({getTotalItems()} items)</span>
            <span>${getSubtotal().toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Tax</span>
            <span>${getTax().toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Shipping</span>
            <span>{getShipping() === 0 ? "FREE" : `$${getShipping().toFixed(2)}`}</span>
          </div>
          {getShipping() === 0 && (
            <p className="text-xs text-green-600">
              🎉 You qualify for free shipping!
            </p>
          )}
          <Separator />
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>${getTotalPrice().toFixed(2)}</span>
          </div>
        </div>

        {outOfStockItems.length > 0 && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-amber-800">
              Remove out-of-stock items to proceed with checkout
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Button
            size="lg"
            className="w-full bg-indigo-600 hover:bg-indigo-700"
            disabled={outOfStockItems.length > 0 || inStockItems.length === 0}
            onClick={handleProceedToCheckout}
          >
            Proceed to Checkout
          </Button>
          
          <Button variant="outline" size="lg" className="w-full" asChild>
            <Link href="/shop">Continue Shopping</Link>
          </Button>
        </div>

        {/* Trust Indicators */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs text-gray-600">
          <div className="flex flex-col items-center gap-1">
            <Shield className="h-4 w-4 text-green-600" />
            <span>Secure</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Truck className="h-4 w-4 text-green-600" />
            <span>Fast Ship</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <RotateCcw className="h-4 w-4 text-green-600" />
            <span>Returns</span>
          </div>
        </div>
      </div>
    </div>
  )
}

interface CartItemProps {
  item: any
  onUpdateQuantity: (id: string, quantity: number) => void
  onRemove: (id: string) => void
  disabled?: boolean
}

function CartItem({ item, onUpdateQuantity, onRemove, disabled = false }: CartItemProps) {
  const [imageError, setImageError] = useState(false)

  return (
    <div className={cn("flex gap-3", disabled && "opacity-60")}>
      {/* Product Image */}
      <div className="relative w-16 h-16 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
        <Image
          src={!imageError && item.image ? item.image : "/placeholder.svg"}
          alt={item.title}
          fill
          sizes="64px"
          className="object-cover"
          onError={() => setImageError(true)}
        />
        {disabled && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Badge variant="destructive" className="text-xs">
              Out of Stock
            </Badge>
          </div>
        )}
      </div>

      {/* Product Details */}
      <div className="flex-1 min-w-0 space-y-1">
        <h4 className="font-medium text-sm text-gray-900 line-clamp-2">
          {item.title}
        </h4>
        
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span>by {item.supplierName}</span>
          {item.supplierVerified && (
            <CheckCircle className="h-3 w-3 text-blue-500" />
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">${item.price}</span>
          {item.originalPrice && (
            <span className="text-xs text-gray-500 line-through">
              ${item.originalPrice}
            </span>
          )}
        </div>

        {!disabled && (
          <div className="flex items-center gap-2">
            <div className="flex items-center border rounded-md bg-gray-50">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                disabled={item.quantity <= 1}
                className="h-6 w-6 p-0 hover:bg-gray-200"
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="px-2 text-xs font-medium min-w-[24px] text-center">
                {item.quantity}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                disabled={item.quantity >= item.maxQuantity}
                className="h-6 w-6 p-0 hover:bg-gray-200"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            
            <div className="text-xs font-semibold">
              ${(item.price * item.quantity).toFixed(2)}
            </div>
          </div>
        )}
      </div>

      {/* Remove Button */}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onRemove(item.id)}
        className="h-6 w-6 p-0 text-gray-400 hover:text-red-600 flex-shrink-0"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  )
}

function EmptyCart() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-6">
      <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
        <ShoppingCart className="h-10 w-10 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Your cart is empty</h3>
      <p className="text-gray-600 mb-6 max-w-sm">
        Discover amazing products curated by your favorite creators
      </p>
      <Button asChild className="bg-indigo-600 hover:bg-indigo-700">
        <Link href="/shop">Start Shopping</Link>
      </Button>
    </div>
  )
}
