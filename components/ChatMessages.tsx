import React from 'react'
import { useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { User, Bot, Paperclip, MoreVertical, GitBranch, RotateCcw } from 'lucide-react'
import { MarkdownMessage } from './MarkdownMessage'
import { MessageInput } from './MessageInput'
import type { Chat, Message } from '../types/chat'

interface ChatMessagesProps {
  selectedChat: Chat | null
  isStreaming: boolean
  messageInput: string
  setMessageInput: (message: string) => void
  selectedModel: string
  setSelectedModel: (model: string) => void
  handleSendMessage: (attachments?: { name: string; type: string; url: string }[]) => void
  handleGenerateImage: () => void
  handleKeyPress: (e: React.KeyboardEvent) => void
  onCreateBranch: (fromMessageId?: string) => void
  onResendMessage: (messageId: string) => void
  user: any
}

export function ChatMessages({ 
  selectedChat, 
  isStreaming, 
  messageInput, 
  setMessageInput, 
  selectedModel, 
  setSelectedModel, 
  handleSendMessage, 
  handleGenerateImage,
  handleKeyPress,
  onCreateBranch,
  onResendMessage,
  user
}: ChatMessagesProps) {
  const [attachments, setAttachments] = useState<{ name: string; type: string; url: string }[]>([])
  return (
    <div className="bg-gray-900 p-3 md:p-6 mt-2 ml-1 md:ml-2 mr-1 md:mr-2 rounded-tl-lg rounded-tr-lg flex-1 relative shadow-[inset_10px_10px_40px_2px_rgba(157,157,157,0.1)] min-h-0">
      <ScrollArea className="h-full pb-40">
        <div className="max-w-full md:max-w-[50%] mx-auto space-y-6 px-2 md:px-0">
          {selectedChat ? selectedChat.messages.map((msg) => (
            <div key={msg.id} className="space-y-4">
              {msg.role === "user" ? (
                <div className="flex justify-end group">
                  <div className="flex items-start gap-2 max-w-[80%]">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0 text-gray-400 hover:text-gray-300"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onCreateBranch(msg.id)}>
                          <GitBranch className="h-4 w-4 mr-2" />
                          Branch from Here
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onResendMessage(msg.id)}>
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Resend Message
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <div className="bg-teal-600 text-white rounded-2xl rounded-tr-md px-4 py-3 space-y-2">
                      <div className="text-sm">{msg.content}</div>
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="space-y-2">
                          {msg.attachments.map((attachment, index) => (
                            <div key={index}>
                              {attachment.type.startsWith('image/') && attachment.url ? (
                                <div className="bg-teal-700 rounded-lg p-2 text-white text-xs">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Paperclip className="w-3 h-3" />
                                    <span>{attachment.name}</span>
                                  </div>
                                  <a 
                                    href={attachment.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="block"
                                  >
                                    <img 
                                      src={attachment.url} 
                                      alt={attachment.name}
                                      className="max-w-xs max-h-48 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                      loading="lazy"
                                    />
                                  </a>
                                </div>
                              ) : (
                                <div className="bg-teal-700 rounded-lg p-2 flex items-center gap-2 text-white text-xs">
                                  <Paperclip className="w-3 h-3" />
                                  {attachment.url ? (
                                    <a 
                                      href={attachment.url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="hover:underline cursor-pointer"
                                    >
                                      {attachment.name}
                                    </a>
                                  ) : (
                                    <span>{attachment.name}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex justify-start group">
                  <div className="max-w-[80vw] space-y-4">
                    {msg.content.startsWith('data:image/') ? (
                      <img 
                        src={msg.content} 
                        alt="Generated image"
                        className="max-w-[60%] h-auto rounded-lg"
                        loading="lazy"
                      />
                    ) : (
                      <MarkdownMessage content={msg.content} />
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0 text-gray-400 hover:text-gray-300 ml-2"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => onCreateBranch(msg.id)}>
                        <GitBranch className="h-4 w-4 mr-2" />
                        Branch from Here
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          )) : (
            <div className="text-center text-gray-400 py-8">
              Select a chat to start messaging
            </div>
          )}
          
          {/* Loading Animation for Streaming */}
          {isStreaming && (
            <div className="flex justify-start">
              <div className="max-w-[90%] space-y-4">
                <div className="text-gray-300 flex items-center gap-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce"></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
      
      <MessageInput
        message={messageInput}
        setMessage={setMessageInput}
        selectedChat={selectedChat}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        isStreaming={isStreaming}
        onSendMessage={() => {
          handleSendMessage(attachments)
          setAttachments([]) // Clear attachments after sending
        }}
        onGenerateImage={handleGenerateImage}
        onKeyPress={handleKeyPress}
        attachments={attachments}
        onAttachmentsChange={setAttachments}
        user={user}
      />
    </div>
  )
}