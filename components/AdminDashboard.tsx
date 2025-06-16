'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Settings, User, Save, Search } from 'lucide-react'
import { useUser } from '@clerk/nextjs'

interface UserLimits {
  userId: string
  totalLimit: number
  premiumLimit: number
}

export function AdminDashboard() {
  const { user, isLoaded } = useUser()
  const [targetUserId, setTargetUserId] = useState('')
  const [totalLimit, setTotalLimit] = useState(100)
  const [premiumLimit, setPremiumLimit] = useState(20)
  const [currentLimits, setCurrentLimits] = useState<UserLimits | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchUserLimits = async () => {
    if (!targetUserId.trim()) {
      setMessage({ type: 'error', text: 'Please enter a user ID' })
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      const response = await fetch(`/api/admin/user-limits?userId=${encodeURIComponent(targetUserId)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch user limits')
      }

      const data = await response.json()
      setCurrentLimits(data)
      setTotalLimit(data.totalLimit)
      setPremiumLimit(data.premiumLimit)
      setMessage({ type: 'success', text: 'User limits loaded successfully' })
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Unknown error' })
    } finally {
      setLoading(false)
    }
  }

  const updateUserLimits = async () => {
    if (!targetUserId.trim()) {
      setMessage({ type: 'error', text: 'Please enter a user ID' })
      return
    }

    if (totalLimit < 0 || premiumLimit < 0) {
      setMessage({ type: 'error', text: 'Limits must be non-negative numbers' })
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      const response = await fetch('/api/admin/user-limits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: targetUserId,
          totalLimit,
          premiumLimit
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update user limits')
      }

      const data = await response.json()
      setMessage({ type: 'success', text: data.message })
      
      // Update current limits display
      setCurrentLimits({
        userId: targetUserId,
        totalLimit,
        premiumLimit
      })
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Unknown error' })
    } finally {
      setLoading(false)
    }
  }

  if (!isLoaded || !user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Admin Dashboard
          </CardTitle>
          <CardDescription>
            Sign in to access admin features
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Admin Dashboard
        </CardTitle>
        <CardDescription>
          Manage user limits and system settings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* User ID Input */}
        <div className="space-y-2">
          <Label htmlFor="userId">Target User ID</Label>
          <div className="flex gap-2">
            <Input
              id="userId"
              placeholder="Enter user ID (e.g., user_xxxxxxxxx)"
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={fetchUserLimits}
              disabled={loading}
              variant="outline"
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Current Limits Display */}
        {currentLimits && (
          <div className="p-4 bg-muted rounded-lg">
            <h3 className="font-medium mb-2 flex items-center gap-2">
              <User className="h-4 w-4" />
              Current Limits for {currentLimits.userId}
            </h3>
            <div className="flex gap-4">
              <Badge variant="secondary">
                Standard: {currentLimits.totalLimit}
              </Badge>
              <Badge variant="secondary">
                Premium: {currentLimits.premiumLimit}
              </Badge>
            </div>
          </div>
        )}

        {/* Limit Controls */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="totalLimit">Standard Messages Limit</Label>
            <Input
              id="totalLimit"
              type="number"
              min="0"
              value={totalLimit}
              onChange={(e) => setTotalLimit(parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="premiumLimit">Premium Messages Limit</Label>
            <Input
              id="premiumLimit"
              type="number"
              min="0"
              value={premiumLimit}
              onChange={(e) => setPremiumLimit(parseInt(e.target.value) || 0)}
            />
          </div>
        </div>

        {/* Update Button */}
        <Button
          onClick={updateUserLimits}
          disabled={loading || !targetUserId.trim()}
          className="w-full"
        >
          <Save className="h-4 w-4 mr-2" />
          {loading ? 'Updating...' : 'Update User Limits'}
        </Button>

        {/* Message Display */}
        {message && (
          <div className={`p-3 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-100 text-green-800 border border-green-200' 
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Info */}
        <div className="text-sm text-muted-foreground space-y-2">
          <p><strong>Note:</strong> Premium messages (Claude models, image generation) only count towards the premium limit, not the standard limit.</p>
          <p><strong>Default Limits:</strong> Standard: 100, Premium: 20</p>
        </div>
      </CardContent>
    </Card>
  )
}