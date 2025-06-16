import React from 'react'
import { Button } from '@/components/ui/button'
import { Menu, GitBranch } from 'lucide-react'
import { TypewriterText } from './TypewriterText'
import type { Chat } from '../types/chat'

interface ChatHeaderProps {
  selectedChat: Chat | null
  sidebarVisible: boolean
  setSidebarVisible: (visible: boolean) => void
  showBranches: boolean
  setShowBranches: (show: boolean) => void
}

export function ChatHeader({ 
  selectedChat, 
  sidebarVisible, 
  setSidebarVisible, 
  showBranches, 
  setShowBranches 
}: ChatHeaderProps) {
  return (
    <div className="p-3 flex items-center justify-between">
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
              <TypewriterText text={selectedChat.title} className="text-lg md:text-lg text-base font-semibold truncate" />
              {selectedChat.parentChatId && (
                <span className="text-xs bg-blue-900 text-blue-200 px-2 py-1 rounded flex-shrink-0">
                  Branch
                </span>
              )}
            </div>
          ) : (
            <span className="text-lg md:text-lg text-base font-semibold text-gray-400">Select a chat</span>
          )}
        </div>
      </div>
      
      {selectedChat && (
        <Button
          onClick={() => setShowBranches(!showBranches)}
          className="ml-3 flex-shrink-0 hidden md:flex"
        >
          <GitBranch className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}