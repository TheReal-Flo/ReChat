import React, { memo, useState, useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { User, Bot, Paperclip, MoreVertical, GitBranch, RotateCcw, MessageSquare, Code, Lightbulb, FileText, Calculator, Globe } from 'lucide-react'
import { MarkdownMessage } from './MarkdownMessage'
import { MessageInput } from './MessageInput'
import type { Chat, Message } from '../types/chat'


interface ChatMessagesProps {
  selectedChat: Chat | null
  isStreaming: boolean
  isSending: boolean
  streamingMessage?: string
  messageInput: string
  setMessageInput: (message: string) => void
  selectedModel: string
  setSelectedModel: (model: string) => void
  handleSendMessage: (attachments?: { name: string; type: string; url: string }[]) => void
  handleKeyPress: (e: React.KeyboardEvent) => void
  onCreateBranch: (fromMessageId?: string) => void
  onResendMessage: (messageId: string) => void
  user: any
}

const ChatMessages = memo(function ChatMessages({ 
  selectedChat, 
  isStreaming, 
  isSending,
  streamingMessage,
  messageInput, 
  setMessageInput, 
  selectedModel, 
  setSelectedModel, 
  handleSendMessage, 
  handleKeyPress,
  onCreateBranch,
  onResendMessage,
  user
}: ChatMessagesProps) {
  const [attachments, setAttachments] = useState<{ name: string; type: string; url: string }[]>([])
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  
  // Auto-scroll to bottom when streaming message updates
  useEffect(() => {
    if (isStreaming && scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [isStreaming, streamingMessage])


  return (
    <div className="bg-gray-900/80 glass-effect neural-grid p-3 md:p-6 mt-2 ml-1 md:ml-2 mr-1 md:mr-2 rounded-tl-lg rounded-tr-lg flex-1 relative glow-border min-h-0 transition-all duration-300 overflow-hidden">

      <ScrollArea ref={scrollAreaRef} className="h-full pr-4 pb-40 overflow-hidden max-w-full !block">
        <div className="w-full max-w-full md:max-w-[50%] mx-auto space-y-6 px-2 md:px-0">
          {selectedChat ? (
            selectedChat.messages.length > 0 ? selectedChat.messages.map((msg) => (
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
                    <div className="bg-gradient-to-br from-teal-600 to-teal-700 text-white rounded-2xl rounded-tr-md px-4 py-3 space-y-2 shadow-lg shadow-teal-600/20 border border-teal-500/30 backdrop-blur-sm transition-all duration-200 hover:shadow-teal-600/30">
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
                <div className="flex justify-start group max-w-full">
                  <div className="max-w-[80%] space-y-4">
                    {msg.content.startsWith('data:image/') ? (
                      <img 
                        src={msg.content} 
                        alt="Generated image"
                        className="max-w-[60%] h-auto rounded-lg"
                        loading="lazy"
                      />
                    ) : (
                      <MarkdownMessage 
                        content={msg.content} 
                        className={msg.content.includes('Sorry, there was an error processing your request') ? 'text-red-400 border border-red-500/30 bg-red-500/10 p-3 rounded-lg' : ''}
                      />
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
              // Recommended tasks view when chat is empty
              <div className="space-y-6 py-8">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-white mb-2">Welcome to ReChat!</h2>
                  <p className="text-gray-400">Here are some things you can try:</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
                  <Card 
                    className="bg-gray-800/50 border-gray-700 hover:bg-gray-800/70 transition-colors cursor-pointer group"
                    onClick={() => setMessageInput("Explain quantum computing in simple terms")}
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-white group-hover:text-teal-400 transition-colors">
                        <Lightbulb className="h-5 w-5" />
                        Learn Something New
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-gray-400">
                        Ask me to explain complex topics in simple terms
                      </CardDescription>
                    </CardContent>
                  </Card>

                  <Card 
                    className="bg-gray-800/50 border-gray-700 hover:bg-gray-800/70 transition-colors cursor-pointer group"
                    onClick={() => setMessageInput("Write a Python function to calculate fibonacci numbers")}
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-white group-hover:text-teal-400 transition-colors">
                        <Code className="h-5 w-5" />
                        Code Assistant
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-gray-400">
                        Get help with programming and code examples
                      </CardDescription>
                    </CardContent>
                  </Card>

                  <Card 
                    className="bg-gray-800/50 border-gray-700 hover:bg-gray-800/70 transition-colors cursor-pointer group"
                    onClick={() => setMessageInput("Help me write a professional email to my manager")}
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-white group-hover:text-teal-400 transition-colors">
                        <FileText className="h-5 w-5" />
                        Writing Helper
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-gray-400">
                        Assistance with writing, editing, and communication
                      </CardDescription>
                    </CardContent>
                  </Card>

                  <Card 
                    className="bg-gray-800/50 border-gray-700 hover:bg-gray-800/70 transition-colors cursor-pointer group"
                    onClick={() => setMessageInput("What are the latest trends in artificial intelligence?")}
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-white group-hover:text-teal-400 transition-colors">
                        <Globe className="h-5 w-5" />
                        Current Events
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-gray-400">
                        Discuss current trends and recent developments
                      </CardDescription>
                    </CardContent>
                  </Card>

                  <Card 
                    className="bg-gray-800/50 border-gray-700 hover:bg-gray-800/70 transition-colors cursor-pointer group"
                    onClick={() => setMessageInput("Solve this math problem: What is the derivative of x^2 + 3x + 5?")}
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-white group-hover:text-teal-400 transition-colors">
                        <Calculator className="h-5 w-5" />
                        Math & Problem Solving
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-gray-400">
                        Help with mathematics, calculations, and logic problems
                      </CardDescription>
                    </CardContent>
                  </Card>

                  <Card 
                    className="bg-gray-800/50 border-gray-700 hover:bg-gray-800/70 transition-colors cursor-pointer group"
                    onClick={() => setMessageInput("Give me creative ideas for a weekend project")}
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-white group-hover:text-teal-400 transition-colors">
                        <MessageSquare className="h-5 w-5" />
                        Creative Ideas
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-gray-400">
                        Brainstorm creative solutions and innovative ideas
                      </CardDescription>
                    </CardContent>
                  </Card>
                </div>
                
                <div className="text-center mt-8">
                  <p className="text-gray-500 text-sm">
                    Click on any card above to get started, or type your own question below!
                  </p>
                </div>
              </div>
            )
          ) : (
            <div className="text-center text-gray-400 py-8">
              Select a chat to start messaging
            </div>
          )}
          

          
          {/* Streaming Message Display */}
          {isStreaming && (
            <div className="flex justify-start group max-w-full">
              <div className="max-w-[80%] space-y-4">
                {streamingMessage ? (
                  <MarkdownMessage 
                    content={streamingMessage} 
                    className=""
                  />
                ) : (
                  <div className="text-gray-300 flex items-center gap-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce"></div>
                    </div>
                  </div>
                )}
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
        isSending={isSending}
        onSendMessage={() => {
          handleSendMessage(attachments)
          setAttachments([]) // Clear attachments after sending
        }}
        onKeyPress={handleKeyPress}
        attachments={attachments}
        onAttachmentsChange={setAttachments}
        user={user}
      />
    </div>
  )
})

export { ChatMessages }