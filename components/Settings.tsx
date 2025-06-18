import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Eye, EyeOff, Save, Trash2, Brain, Video } from 'lucide-react'
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
  const [openaiApiKey, setOpenaiApiKey] = useState('')
  const [openrouterApiKey, setOpenrouterApiKey] = useState('')
  const [showOpenaiApiKey, setShowOpenaiApiKey] = useState(false)
  const [showOpenrouterApiKey, setShowOpenrouterApiKey] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [memoryEnabled, setMemoryEnabled] = useState(true)
  const [userMemory, setUserMemory] = useState('')
  const [isLoadingMemory, setIsLoadingMemory] = useState(false)
  const [isDeletingMemory, setIsDeletingMemory] = useState(false)
  const [memoryMessage, setMemoryMessage] = useState('')
  const [brainrotMode, setBrainrotMode] = useState(false)

  // Admin user IDs (should match the ones in the API)
  const ADMIN_USER_IDS: string[] = [
    "user_2yaHy0UR8DPmVyYTMib50Zess8z"
  ]

  // Check if current user is admin
  const isAdmin = user?.id ? ADMIN_USER_IDS.includes(user.id) : false

  // Load saved API keys and memory settings on component mount
  useEffect(() => {
    const savedOpenaiApiKey = localStorage.getItem('openai_api_key')
    if (savedOpenaiApiKey) {
      setOpenaiApiKey(savedOpenaiApiKey)
    }
    
    const savedOpenrouterApiKey = localStorage.getItem('openrouter_api_key')
    if (savedOpenrouterApiKey) {
      setOpenrouterApiKey(savedOpenrouterApiKey)
    }
    
    const savedMemoryEnabled = localStorage.getItem('memory_enabled')
    if (savedMemoryEnabled !== null) {
      setMemoryEnabled(savedMemoryEnabled === 'true')
    }
    
    const savedBrainrotMode = localStorage.getItem('brainrot_mode')
    if (savedBrainrotMode !== null) {
      setBrainrotMode(savedBrainrotMode === 'true')
    }
    
    // Load user memory
    loadUserMemory()
  }, [isOpen])

  const loadUserMemory = async () => {
    if (!user?.id) return
    
    setIsLoadingMemory(true)
    try {
      const response = await fetch(`/api/usage/memory?userId=${user.id}`)
      if (response.ok) {
        const data = await response.json()
        setUserMemory(data.memory || '')
      }
    } catch (error) {
      console.error('Error loading memory:', error)
    } finally {
      setIsLoadingMemory(false)
    }
  }

  const handleMemoryToggle = (enabled: boolean) => {
    setMemoryEnabled(enabled)
    localStorage.setItem('memory_enabled', enabled.toString())
    setMemoryMessage(enabled ? 'Memory enabled' : 'Memory disabled')
    setTimeout(() => setMemoryMessage(''), 3000)
  }

  const handleBrainrotModeToggle = (enabled: boolean) => {
    setBrainrotMode(enabled)
    localStorage.setItem('brainrot_mode', enabled.toString())
  }

  const handleDeleteMemory = async () => {
    if (!user?.id) return
    
    setIsDeletingMemory(true)
    setMemoryMessage('')
    
    try {
      const response = await fetch('/api/usage/memory', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      })
      
      if (response.ok) {
        setUserMemory('')
        setMemoryMessage('Memory deleted successfully!')
      } else {
        setMemoryMessage('Failed to delete memory.')
      }
    } catch (error) {
      setMemoryMessage('Error deleting memory.')
      console.error('Error deleting memory:', error)
    } finally {
      setIsDeletingMemory(false)
      setTimeout(() => setMemoryMessage(''), 3000)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveMessage('')
    
    try {
      // Save OpenAI API key
      if (openaiApiKey.trim()) {
        localStorage.setItem('openai_api_key', openaiApiKey.trim())
      } else {
        localStorage.removeItem('openai_api_key')
      }
      
      // Save OpenRouter API key
      if (openrouterApiKey.trim()) {
        localStorage.setItem('openrouter_api_key', openrouterApiKey.trim())
      } else {
        localStorage.removeItem('openrouter_api_key')
      }
      
      setSaveMessage('API keys saved successfully!')
      
      // Clear message after 3 seconds
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      setSaveMessage('Failed to save API keys.')
      console.error('Error saving API keys:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = () => {
    setSaveMessage('')
    setMemoryMessage('')
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
            <TabsTrigger value="memory" className="flex-1 text-xs text-gray-300 data-[state=active]:bg-gray-600 data-[state=active]:text-white px-2 py-2 rounded">
              Memory
            </TabsTrigger>
            <TabsTrigger value="usage" className="flex-1 text-xs text-gray-300 data-[state=active]:bg-gray-600 data-[state=active]:text-white px-2 py-2 rounded">
              Usage Stats
            </TabsTrigger>
            <TabsTrigger value="sync" className="flex-1 text-xs text-gray-300 data-[state=active]:bg-gray-600 data-[state=active]:text-white px-2 py-2 rounded">
              Chat Sync
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="api" className="space-y-4 py-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="openai-api-key" className="text-white">
                OpenAI API Key
              </Label>
              <div className="relative">
                <Input
                  id="openai-api-key"
                  type={showOpenaiApiKey ? 'text' : 'password'}
                  value={openaiApiKey}
                  onChange={(e) => setOpenaiApiKey(e.target.value)}
                  placeholder="Enter your OpenAI API key (for image generation)"
                  className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowOpenaiApiKey(!showOpenaiApiKey)}
                >
                  {showOpenaiApiKey ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Used for image generation. Get your key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">OpenAI Platform</a>.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="openrouter-api-key" className="text-white">
                OpenRouter API Key
              </Label>
              <div className="relative">
                <Input
                  id="openrouter-api-key"
                  type={showOpenrouterApiKey ? 'text' : 'password'}
                  value={openrouterApiKey}
                  onChange={(e) => setOpenrouterApiKey(e.target.value)}
                  placeholder="Enter your OpenRouter API key (for chat models)"
                  className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowOpenrouterApiKey(!showOpenrouterApiKey)}
                >
                  {showOpenrouterApiKey ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Used for chat models. Get your key from <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">OpenRouter</a>.
              </p>
            </div>
            
            <div className="pt-2">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save API Keys'}
              </Button>
            </div>
            
            <p className="text-xs text-gray-500">
              Your API keys are stored locally and only sent to the respective services for requests.
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
          
          <TabsContent value="memory" className="space-y-4 py-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-white flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    Memory System
                  </Label>
                  <p className="text-xs text-gray-400">
                    Enable the AI to remember your preferences and context across conversations.
                  </p>
                </div>
                <Switch
                  checked={memoryEnabled}
                  onCheckedChange={handleMemoryToggle}
                  className="data-[state=checked]:bg-teal-600"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-white flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    Brainrot Mode
                  </Label>
                  <p className="text-xs text-gray-400">
                    Play a video while AI responses are loading for maximum brainrot experience.
                  </p>
                </div>
                <Switch
                  checked={brainrotMode}
                  onCheckedChange={handleBrainrotModeToggle}
                  className="data-[state=checked]:bg-teal-600"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-white">Current Memory Content</Label>
                <div className="bg-gray-700 border border-gray-600 rounded-md p-3 min-h-[100px]">
                  {isLoadingMemory ? (
                    <p className="text-gray-400 text-sm">Loading memory...</p>
                  ) : userMemory ? (
                    <p className="text-gray-300 text-sm whitespace-pre-wrap">{userMemory}</p>
                  ) : (
                    <p className="text-gray-500 text-sm italic">No memory content stored yet.</p>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  The AI will automatically update this content as you interact with it.
                </p>
              </div>
              
              {userMemory && (
                <div className="space-y-2">
                  <Button
                    onClick={handleDeleteMemory}
                    disabled={isDeletingMemory}
                    variant="destructive"
                    className="w-full bg-red-600 hover:bg-red-700"
                  >
                    {isDeletingMemory ? (
                      'Deleting...'
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete All Memory
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-gray-500">
                    This will permanently delete all stored memory content. This action cannot be undone.
                  </p>
                </div>
              )}
              
              {memoryMessage && (
                <div className={`text-sm p-2 rounded ${
                  memoryMessage.includes('successfully') || memoryMessage.includes('enabled') || memoryMessage.includes('disabled')
                    ? 'bg-green-900 text-green-200'
                    : 'bg-red-900 text-red-200'
                }`}>
                  {memoryMessage}
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="usage" className="py-4">
            <UsageDashboard />
          </TabsContent>
          
          <TabsContent value="sync" className="py-4">
            <SyncDashboard />
          </TabsContent>
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