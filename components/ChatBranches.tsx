import React from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { GitBranch, ArrowLeft, Clock } from 'lucide-react'
import type { Chat } from '../types/chat'

interface ChatBranchesProps {
  currentChat: Chat
  branches: Chat[]
  parentChat?: Chat
  onSelectChat: (chat: Chat) => void
  onCreateBranch: () => void
}

export function ChatBranches({
  currentChat,
  branches,
  parentChat,
  onSelectChat,
  onCreateBranch
}: ChatBranchesProps) {
  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      month: 'short',
      day: 'numeric'
    }).format(date)
  }

  return (
    <div className="w-80 md:w-80 w-full max-w-sm flex flex-col hidden md:flex">
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center gap-2 mb-3">
          <GitBranch className="h-4 w-4" />
          <h3 className="font-semibold">Chat Branches</h3>
        </div>
        
        {parentChat && (
          <div className="mb-3">
            <Button
              onClick={() => onSelectChat(parentChat)}
              className="w-full justify-start"
            >
              <ArrowLeft className="h-3 w-3 mr-2" />
              Back to Parent
            </Button>
          </div>
        )}
        
        <Button
          onClick={onCreateBranch}
          className="w-full"
        >
          <GitBranch className="h-3 w-3 mr-2" />
          Create Branch
        </Button>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {/* Current Chat */}
          <div className="p-3 bg-blue-900/20 border border-blue-800 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Badge className="text-xs">
                Current
              </Badge>
              {currentChat.parentChatId && (
                <Badge className="text-xs">
                  Branch
                </Badge>
              )}
            </div>
            <h4 className="font-medium text-sm mb-1 line-clamp-2">
              {currentChat.title}
            </h4>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Clock className="h-3 w-3" />
              {formatTime(currentChat.timestamp)}
            </div>
          </div>
          
          {/* Branches */}
          {branches.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-2">
                Branches ({branches.length})
              </h4>
              <div className="space-y-2">
                {branches.map((branch) => (
                  <div
                    key={branch.id}
                    className="p-3 bg-gray-800 border border-gray-700 rounded-lg cursor-pointer hover:bg-gray-750 transition-colors"
                    onClick={() => onSelectChat(branch)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="text-xs">
                        Branch
                      </Badge>
                    </div>
                    <h4 className="font-medium text-sm mb-1 line-clamp-2">
                      {branch.title}
                    </h4>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="h-3 w-3" />
                      {formatTime(branch.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {branches.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No branches yet</p>
              <p className="text-xs mt-1">Create a branch to explore different conversation paths</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}