'use client'

import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Separator } from './ui/separator'
import { RefreshCw, Cloud, CloudOff, Download, Upload } from 'lucide-react'
import { useToast } from './ui/use-toast'
import { useAuth } from '@clerk/nextjs'

interface SyncStatus {
  lastSyncTimestamp: string
  pendingChanges: number
  isOnline: boolean
}

export function SyncDashboard() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const { toast } = useToast()
  const { userId } = useAuth()

  // Fetch sync status
  const fetchSyncStatus = async () => {
    try {
      setIsLoading(true)
      console.log('[SYNC DASHBOARD] Fetching sync status...')
      
      const response = await fetch('/api/sync')
      console.log('[SYNC DASHBOARD] API response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('[SYNC DASHBOARD] API error:', errorText)
        throw new Error(`Failed to fetch sync status: ${response.status} ${errorText}`)
      }
      
      const data = await response.json()
      console.log('[SYNC DASHBOARD] Sync status data:', data)
      setSyncStatus(data)
    } catch (error: any) {
      console.error('[SYNC DASHBOARD] Error fetching sync status:', error)
      toast({
        title: 'Error',
        description: `Failed to fetch sync status: ${error.message}`,
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Trigger sync
  const triggerSync = async (direction?: 'to-server' | 'from-server') => {
    try {
      setIsSyncing(true)
      
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ direction })
      })
      
      if (!response.ok) {
        throw new Error('Sync failed')
      }
      
      const data = await response.json()
      
      // Check if client-side sync is required
      if (data.requiresClientSync) {
        console.log('[SYNC DASHBOARD] Performing client-side sync:', direction)
        
        // Dynamically import ChatSyncService to avoid server-side bundling issues
        const { ChatSyncService } = await import('../lib/chat-sync')
        
        if (!userId) {
          throw new Error('User not authenticated')
        }
        
        // Perform the appropriate sync operation
        if (direction === 'to-server') {
          await ChatSyncService.syncToServer(userId)
        } else if (direction === 'from-server') {
          await ChatSyncService.syncFromServer(userId)
        } else {
          await ChatSyncService.performFullSync(userId)
        }
        
        // Refresh sync status after client-side sync
        await fetchSyncStatus()
      } else {
        // Server handled the sync, update status from response
        setSyncStatus(data.status)
      }
      
      toast({
        title: 'Success',
        description: 'Chat history synced successfully'
      })
    } catch (error: any) {
      console.error('Error during sync:', error)
      toast({
        title: 'Sync Failed',
        description: error.message || 'Failed to sync chat history',
        variant: 'destructive'
      })
    } finally {
      setIsSyncing(false)
    }
  }

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    if (date.getTime() === 0) return 'Never'
    
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
    return `${days} day${days > 1 ? 's' : ''} ago`
  }

  // Load sync status on component mount
  useEffect(() => {
    fetchSyncStatus()
  }, [])

  return (
    <Card className='bg-transparent'>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-5 w-5" />
          Chat History Sync
        </CardTitle>
        <CardDescription>
          Synchronize your chat history across devices
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sync Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Status:</span>
            {syncStatus?.isOnline ? (
              <Badge variant="default" className="flex items-center gap-1">
                <Cloud className="h-3 w-3" />
                Online
              </Badge>
            ) : (
              <Badge variant="secondary" className="flex items-center gap-1">
                <CloudOff className="h-3 w-3" />
                Offline
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSyncStatus}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Last Sync */}
        {syncStatus && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Last sync:</span>
              <span className="font-medium">
                {formatTimestamp(syncStatus.lastSyncTimestamp)}
              </span>
            </div>
            
            {syncStatus.pendingChanges > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Pending changes:</span>
                <Badge variant="outline">{syncStatus.pendingChanges}</Badge>
              </div>
            )}
          </div>
        )}

        <Separator />

        {/* Sync Actions */}
        <div className="space-y-3">
          <div className="text-sm font-medium">Sync Actions</div>
          
          <div className="grid grid-cols-1 gap-2">
            {/* Full Sync */}
            <Button
              onClick={() => triggerSync()}
              disabled={isSyncing || !syncStatus?.isOnline}
              className="w-full justify-start"
            >
              {isSyncing ? 'Syncing...' : 'Full Sync'}
            </Button>
            
            {/* Upload to Server */}
            <Button
              variant="outline"
              onClick={() => triggerSync('to-server')}
              disabled={isSyncing || !syncStatus?.isOnline}
              className="w-full justify-start"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload to Cloud
            </Button>
            
            {/* Download from Server */}
            <Button
              variant="outline"
              onClick={() => triggerSync('from-server')}
              disabled={isSyncing || !syncStatus?.isOnline}
              className="w-full justify-start"
            >
              <Download className="h-4 w-4 mr-2" />
              Download from Cloud
            </Button>
          </div>
        </div>

        {/* Info */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• <strong>Full Sync:</strong> Synchronizes changes in both directions</p>
          <p>• <strong>Upload:</strong> Saves local chats to the cloud</p>
          <p>• <strong>Download:</strong> Retrieves chats from the cloud</p>
          <p>• Automatic sync occurs every 30 seconds when online</p>
        </div>
      </CardContent>
    </Card>
  )
}