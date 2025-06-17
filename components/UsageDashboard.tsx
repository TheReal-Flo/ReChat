'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RefreshCw, MessageSquare, Crown, AlertTriangle } from 'lucide-react'
import { useUser } from '@clerk/nextjs'

interface UsageStats {
  userId: string
  totalMessages: number
  premiumMessages: number
  lastReset: string
  canSendMessage: boolean
  canSendPremiumMessage: boolean
  totalLimit?: number
  premiumLimit?: number
}

// These will be fetched from the API along with usage stats
let USAGE_LIMITS = {
  TOTAL_MESSAGES: 100,
  PREMIUM_MESSAGES: 20
}

const PREMIUM_MODELS = [
  'claude-3.5-sonnet',
  'claude-3-haiku',
  'claude-3-opus',
  'claude-3.7-sonnet',
  'claude-sonnet-4',
  'claude-opus-4'
]

export function UsageDashboard() {
  const { user, isLoaded } = useUser()
  const [usage, setUsage] = useState<UsageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUsage = async () => {
    if (!user?.id) return
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/usage', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch usage data')
      }
      
      const data = await response.json()
      setUsage(data)
      
      // Update limits from API response
      if (data.totalLimit !== undefined && data.premiumLimit !== undefined) {
        USAGE_LIMITS.TOTAL_MESSAGES = data.totalLimit
        USAGE_LIMITS.PREMIUM_MESSAGES = data.premiumLimit
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isLoaded && user?.id) {
      fetchUsage()
    }
  }, [isLoaded, user?.id])

  if (!isLoaded || !user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Usage Dashboard
          </CardTitle>
          <CardDescription>
            Sign in to view your usage statistics
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Usage Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Usage Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 py-8">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground text-center">{error}</p>
            <Button onClick={fetchUsage} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!usage) {
    return null
  }

  const totalProgress = (usage.totalMessages / USAGE_LIMITS.TOTAL_MESSAGES) * 100
  const premiumProgress = (usage.premiumMessages / USAGE_LIMITS.PREMIUM_MESSAGES) * 100

  return (
    <Card className='bg-transparent'>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Usage Dashboard
            </CardTitle>
            <CardDescription>
              Monthly usage limits reset on the 1st of each month<br />
              You don't need to worry about usage when you bring your own OpenRouter key
            </CardDescription>
          </div>
          <Button onClick={fetchUsage} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Total Messages */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="font-medium">Total Messages</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {usage.totalMessages} / {USAGE_LIMITS.TOTAL_MESSAGES}
              </span>
              {!usage.canSendMessage && (
                <Badge variant="destructive" className="text-xs">
                  Limit Reached
                </Badge>
              )}
            </div>
          </div>
          <Progress 
            value={totalProgress} 
            className="h-2"
            // @ts-ignore
            indicatorClassName={totalProgress >= 100 ? 'bg-destructive' : totalProgress >= 80 ? 'bg-yellow-500' : 'bg-primary'}
          />
          <p className="text-xs text-muted-foreground">
            Includes all models (free and premium)
          </p>
        </div>

        {/* Premium Messages */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-yellow-500" />
              <span className="font-medium">Premium Messages</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {usage.premiumMessages} / {USAGE_LIMITS.PREMIUM_MESSAGES}
              </span>
              {!usage.canSendPremiumMessage && (
                <Badge variant="destructive" className="text-xs">
                  Limit Reached
                </Badge>
              )}
            </div>
          </div>
          <Progress 
            value={premiumProgress} 
            className="h-2"
            // @ts-ignore
            indicatorClassName={premiumProgress >= 100 ? 'bg-destructive' : premiumProgress >= 80 ? 'bg-yellow-500' : 'bg-yellow-500'}
          />
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              Premium models: Claude models
            </p>
            <div className="flex flex-wrap gap-1">
              {PREMIUM_MODELS.map((model) => (
                <Badge key={model} variant="secondary" className="text-xs">
                  {model}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Status Messages */}
        {!usage.canSendMessage && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">
                Monthly message limit reached
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              You've reached your monthly limit of {USAGE_LIMITS.TOTAL_MESSAGES} messages. Limits reset on the 1st of each month.
            </p>
          </div>
        )}

        {!usage.canSendPremiumMessage && usage.canSendMessage && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800">
                Premium message limit reached
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              You can still use free models, but premium models (Claude) are unavailable until next month.
            </p>
          </div>
        )}

        {usage.canSendMessage && usage.canSendPremiumMessage && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">
                All systems go!
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              You can use all available models.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}