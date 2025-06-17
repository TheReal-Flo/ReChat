'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { RefreshCw, Upload, Download, Wifi, WifiOff, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { ChatSyncService } from '@/lib/chat-sync'
import { useAuth } from '@clerk/nextjs'
import { SyncSettings, SyncStatus } from '@/types/chat'

export function SyncDashboard() {
  const { userId } = useAuth();

  const [syncSettings, setSyncSettings] = useState<SyncSettings>({
    enabled: false,
    autoUpload: true,
    downloadInterval: 30
  })
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    lastSyncTimestamp: new Date(0),
    pendingChanges: 0,
    isOnline: navigator.onLine,
    syncEnabled: false
  })
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    loadSyncSettings()
    loadSyncStatus()
    
    // Listen for online/offline events
    const handleOnline = () => setSyncStatus(prev => ({ ...prev, isOnline: true }))
    const handleOffline = () => setSyncStatus(prev => ({ ...prev, isOnline: false }))
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const loadSyncSettings = async () => {
    try {
      const settings = await ChatSyncService.getSyncSettings()
      setSyncSettings(settings)
    } catch (error) {
      console.error('Failed to load sync settings:', error)
    }
  }

  const loadSyncStatus = async () => {
    try {
      const status = await ChatSyncService.getSyncStatus(userId ?? "")
      setSyncStatus(status)
    } catch (error) {
      console.error('Failed to load sync status:', error)
    }
  }

  const handleSettingsChange = async (newSettings: Partial<SyncSettings>) => {
    setIsLoading(true)
    try {
      const updatedSettings = { ...syncSettings, ...newSettings }
      await ChatSyncService.setSyncSettings(updatedSettings)
      setSyncSettings(updatedSettings)
      
      if (updatedSettings.enabled) {
        await ChatSyncService.initialize()
        setMessage('Sync enabled successfully!')
      } else {
        ChatSyncService.cleanup()
        setMessage('Sync disabled.')
      }
      
      await loadSyncStatus()
    } catch (error) {
      setMessage('Failed to update sync settings.')
      console.error('Error updating sync settings:', error)
    } finally {
      setIsLoading(false)
      setTimeout(() => setMessage(''), 3000)
    }
  }

  const handleManualSync = async () => {
    setIsSyncing(true)
    try {
      await ChatSyncService.performFullSync(userId ?? "")
      await loadSyncStatus()
      setMessage('Manual sync completed successfully!')
    } catch (error) {
      setMessage('Manual sync failed.')
      console.error('Manual sync error:', error)
    } finally {
      setIsSyncing(false)
      setTimeout(() => setMessage(''), 3000)
    }
  }

  const formatLastSync = (timestamp: Date | null) => {
    if (!timestamp) return 'Never'
    const now = new Date()
    const diff = now.getTime() - timestamp.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
    return 'Just now'
  }

  return (
    <div className="space-y-6">
      {/* Sync Enable/Disable */}
      <Card className="bg-gray-700 border-gray-600">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Chat Synchronization
          </CardTitle>
          <CardDescription className="text-gray-400">
            Sync your chats across devices with a local-first approach.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-white">Enable Sync</Label>
              <p className="text-xs text-gray-400">
                Turn on to sync chats across devices. Local changes always take priority.
              </p>
            </div>
            <Switch
              checked={syncSettings.enabled}
              onCheckedChange={(enabled) => handleSettingsChange({ enabled })}
              disabled={isLoading}
              className="data-[state=checked]:bg-teal-600"
            />
          </div>
        </CardContent>
      </Card>

      {/* Sync Settings */}
      {syncSettings.enabled && (
        <Card className="bg-gray-700 border-gray-600">
          <CardHeader>
            <CardTitle className="text-white text-lg">Sync Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-white flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Auto Upload
                </Label>
                <p className="text-xs text-gray-400">
                  Automatically upload changes after each message.
                </p>
              </div>
              <Switch
                checked={syncSettings.autoUpload}
                onCheckedChange={(autoUpload) => handleSettingsChange({ autoUpload })}
                disabled={isLoading}
                className="data-[state=checked]:bg-teal-600"
              />
            </div>
            
            <Separator className="bg-gray-600" />
            
            <div className="space-y-2">
              <Label className="text-white flex items-center gap-2">
                <Download className="h-4 w-4" />
                Download Interval (seconds)
              </Label>
              <Input
                type="number"
                min="10"
                max="300"
                value={syncSettings.downloadInterval}
                onChange={(e) => {
                  const downloadInterval = parseInt(e.target.value) || 30
                  handleSettingsChange({ downloadInterval })
                }}
                className="bg-gray-600 border-gray-500 text-white w-24"
                disabled={isLoading}
              />
              <p className="text-xs text-gray-400">
                How often to check for new messages from other devices (10-300 seconds).
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sync Status */}
      {syncSettings.enabled && (
        <Card className="bg-gray-700 border-gray-600">
          <CardHeader>
            <CardTitle className="text-white text-lg">Sync Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-white flex items-center gap-2">
                  {syncStatus.isOnline ? (
                    <Wifi className="h-4 w-4 text-green-400" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-red-400" />
                  )}
                  Connection
                </Label>
                <Badge 
                  variant={syncStatus.isOnline ? "default" : "destructive"}
                  className={syncStatus.isOnline ? "bg-green-600" : "bg-red-600"}
                >
                  {syncStatus.isOnline ? 'Online' : 'Offline'}
                </Badge>
              </div>
              
              <div className="space-y-2">
                <Label className="text-white flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Last Sync
                </Label>
                <p className="text-sm text-gray-300">
                  {formatLastSync(syncStatus.lastSyncTimestamp)}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label className="text-white flex items-center gap-2">
                  {syncStatus.pendingChanges > 0 ? (
                    <AlertCircle className="h-4 w-4 text-yellow-400" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-green-400" />
                  )}
                  Pending Changes
                </Label>
                <Badge 
                  variant={syncStatus.pendingChanges > 0 ? "secondary" : "default"}
                  className={syncStatus.pendingChanges > 0 ? "bg-yellow-600" : "bg-green-600"}
                >
                  {syncStatus.pendingChanges}
                </Badge>
              </div>
              
              <div className="space-y-2">
                <Label className="text-white">Sync Status</Label>
                <Badge 
                  variant={syncStatus.syncEnabled ? "default" : "secondary"}
                  className={syncStatus.syncEnabled ? "bg-teal-600" : "bg-gray-600"}
                >
                  {syncStatus.syncEnabled ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
            
            <Separator className="bg-gray-600" />
            
            <Button
              onClick={handleManualSync}
              disabled={isSyncing || !syncStatus.isOnline}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Manual Sync
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Messages */}
      {message && (
        <div className={`text-sm p-3 rounded-md ${
          message.includes('successfully') || message.includes('completed') || message.includes('enabled')
            ? 'bg-green-900 text-green-200 border border-green-700'
            : message.includes('disabled')
            ? 'bg-blue-900 text-blue-200 border border-blue-700'
            : 'bg-red-900 text-red-200 border border-red-700'
        }`}>
          {message}
        </div>
      )}
    </div>
  )
}