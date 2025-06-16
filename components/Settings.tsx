import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Eye, EyeOff, Save } from 'lucide-react'
import { UsageDashboard } from './UsageDashboard'
import { SyncDashboard } from './SyncDashboard'
import { AdminDashboard } from './AdminDashboard'
import { useUser } from '@clerk/nextjs'

interface SettingsProps {
  isOpen: boolean
  onClose: () => void
}

export function Settings({ isOpen, onClose }: SettingsProps) {
  const { user } = useUser()
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  // Admin user IDs (should match the ones in the API)
  const ADMIN_USER_IDS: string[] = [
    "user_2yaHy0UR8DPmVyYTMib50Zess8z"
  ]

  // Check if current user is admin
  const isAdmin = user?.id ? ADMIN_USER_IDS.includes(user.id) : false

  // Load saved API key on component mount
  useEffect(() => {
    const savedApiKey = localStorage.getItem('openai_api_key')
    if (savedApiKey) {
      setApiKey(savedApiKey)
    }
  }, [isOpen])

  const handleSave = async () => {
    setIsSaving(true)
    setSaveMessage('')
    
    try {
      // Save to localStorage
      if (apiKey.trim()) {
        localStorage.setItem('openai_api_key', apiKey.trim())
        setSaveMessage('API key saved successfully!')
      } else {
        localStorage.removeItem('openai_api_key')
        setSaveMessage('API key removed.')
      }
      
      // Clear message after 3 seconds
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      setSaveMessage('Failed to save API key.')
      console.error('Error saving API key:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = () => {
    setSaveMessage('')
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] bg-gray-800 border-gray-700 max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">Settings</DialogTitle>
          <DialogDescription className="text-gray-400">
            Configure your settings and view usage statistics.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="api" className="w-full">
          <TabsList className="flex w-full bg-gray-700 p-1 rounded-lg">
            <TabsTrigger value="api" className="flex-1 text-xs text-gray-300 data-[state=active]:bg-gray-600 data-[state=active]:text-white px-2 py-2 rounded">
              API Settings
            </TabsTrigger>
            <TabsTrigger value="usage" className="flex-1 text-xs text-gray-300 data-[state=active]:bg-gray-600 data-[state=active]:text-white px-2 py-2 rounded">
              Usage Stats
            </TabsTrigger>
            <TabsTrigger value="sync" className="flex-1 text-xs text-gray-300 data-[state=active]:bg-gray-600 data-[state=active]:text-white px-2 py-2 rounded">
              Chat Sync
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="admin" className="flex-1 text-xs text-gray-300 data-[state=active]:bg-gray-600 data-[state=active]:text-white px-2 py-2 rounded">
                Admin
              </TabsTrigger>
            )}
          </TabsList>
          
          <TabsContent value="api" className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="api-key" className="text-white">
              OpenAI API Key
            </Label>
            <div className="relative">
              <Input
                id="api-key"
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your OpenAI API key"
                className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 pr-10"
              />
              <Button
                type="button"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4 text-gray-400" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-400" />
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              Your API key is stored locally and only sent to our server for requests.
            </p>
          </div>
          
          {saveMessage && (
            <div className={`text-sm p-2 rounded ${
              saveMessage.includes('successfully') || saveMessage.includes('removed')
                ? 'bg-green-900 text-green-200'
                : 'bg-red-900 text-red-200'
            }`}>
              {saveMessage}
            </div>
          )}
          </TabsContent>
          
          <TabsContent value="usage" className="py-4">
            <UsageDashboard />
          </TabsContent>
          
          <TabsContent value="sync" className="py-4">
            <SyncDashboard />
          </TabsContent>
          
          {isAdmin && (
            <TabsContent value="admin" className="py-4">
              <AdminDashboard />
            </TabsContent>
          )}
        </Tabs>
        
        <div className="flex justify-end space-x-2 pt-4 border-t border-gray-700">
          <Button
            onClick={handleClose}
            className="border-gray-600 text-gray-300 hover:bg-gray-700"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            {isSaving ? (
              'Saving...'
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}