import React, { memo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Menu, GitBranch, Share, Download, FileText } from 'lucide-react'
import { TypewriterText } from './TypewriterText'
import type { Chat } from '../types/chat'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ChatHeaderProps {
  selectedChat: Chat | null
  sidebarVisible: boolean
  setSidebarVisible: (visible: boolean) => void
  showBranches: boolean
  setShowBranches: (show: boolean) => void
}

const ChatHeader = memo(function ChatHeader({ 
  selectedChat, 
  sidebarVisible, 
  setSidebarVisible, 
  showBranches, 
  setShowBranches 
}: ChatHeaderProps) {
  const handleShare = async () => {
    if (!selectedChat) return
    
    const shareUrl = `${window.location.origin}${window.location.pathname}?chat=${selectedChat.id}`
    
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl)
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea')
        textArea.value = shareUrl
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }
      
      toast.success('Chat link copied to clipboard!')
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      toast.error('Failed to copy link')
    }
  }

  const exportChatAsText = () => {
    if (!selectedChat) return
    
    const chatContent = selectedChat.messages
      .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n\n')
    
    const blob = new Blob([chatContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chat-${selectedChat.id}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast.success('Chat exported as text file!')
  }

  const exportChatAsJSON = () => {
    if (!selectedChat) return
    
    const chatData = {
      id: selectedChat.id,
      title: selectedChat.title,
      messages: selectedChat.messages,
      //createdAt: selectedChat.createdAt,
      updatedAt: selectedChat.updatedAt
    }
    
    const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chat-${selectedChat.id}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast.success('Chat exported as JSON file!')
  }

  return (
    <div className="p-3 flex items-center justify-between bg-transparent backdrop-blur-sm shadow-lg">
      <div className="flex items-center min-w-0 flex-1">
        <Button
          onClick={() => setSidebarVisible(!sidebarVisible)}
          className="mr-3 flex-shrink-0"
        >
          <Menu className="h-4 w-4" />
        </Button>
        
        <div className="flex-1 min-w-0">
          {selectedChat ? (
            <div className="flex items-center gap-2">
              <TypewriterText text={selectedChat.title} className="text-lg md:text-lg font-semibold truncate" />
              {selectedChat.parentChatId && (
                <span className="text-xs bg-blue-900 text-blue-200 px-2 py-1 rounded flex-shrink-0">
                  Branch
                </span>
              )}
            </div>
          ) : (
            <span className="text-lg md:text-lg font-semibold text-gray-400">Select a chat</span>
          )}
        </div>
      </div>
      
      {selectedChat && (
        <div className="flex gap-2">
          <Button
            onClick={handleShare}
            className="flex-shrink-0"
            variant="outline"
            size="sm"
            title="Share chat"
          >
            <Share className="h-4 w-4" />
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex-shrink-0"
                title="Export chat"
              >
                <Download className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportChatAsText}>
                <FileText className="h-4 w-4 mr-2" />
                Export as Text
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportChatAsJSON}>
                <Download className="h-4 w-4 mr-2" />
                Export as JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            onClick={() => setShowBranches(!showBranches)}
            className="flex-shrink-0 hidden md:flex"
            size="sm"
          >
            <GitBranch className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
})

export { ChatHeader }