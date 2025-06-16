"use client"

import { useUser } from '@clerk/nextjs'
import { useState, useEffect, useRef, useCallback } from 'react'
import { chatService } from "./lib/database"
import { ChatSyncService } from "./lib/chat-sync"
import type { Chat, Message } from "./types/chat"
import { ChatSidebar } from "./components/ChatSidebar"
import { ChatHeader } from "./components/ChatHeader"
import { ChatMessages } from "./components/ChatMessages"
import { DeleteChatDialog } from "./components/DeleteChatDialog"
import { ChatBranches } from "./components/ChatBranches"

export default function Component() {
  const { user } = useUser()
  const [message, setMessage] = useState("")
  const [chats, setChats] = useState<Chat[]>([])
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [isSidebarOpen, setSidebarOpen] = useState(true)
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-pro")
  const [isLoading, setIsLoading] = useState(true)
  const [isStreaming, setIsStreaming] = useState(false)
  const [chatToDelete, setChatToDelete] = useState<string | null>(null)
  const [showBranches, setShowBranches] = useState(false)
  const [branches, setBranches] = useState<Chat[]>([])
  const [parentChat, setParentChat] = useState<Chat | undefined>(undefined)
  const [isModelLoaded, setIsModelLoaded] = useState(false)
  // Load chats from database on component mount
  useEffect(() => {
    const loadChats = async () => {
      try {
        setIsLoading(true)
        await chatService.initializeSampleData()
        
        // Auto-sync if user is logged in
        if (user?.id) {
          try {
            console.log('[SYNC DEBUG] Triggering auto-sync for user:', user.id)
            const response = await fetch('/api/sync', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ action: 'auto' }),
            })
            
            if (!response.ok) {
              console.error('[SYNC DEBUG] Auto-sync failed:', response.statusText)
            } else {
              const result = await response.json()
              console.log('[SYNC DEBUG] Server response:', result)
              
              // If server indicates client-side sync is required, perform it
              if (result.requiresClientSync) {
                console.log('[SYNC DEBUG] Performing client-side auto-sync...')
                const { ChatSyncService } = await import('./lib/chat-sync')
                await ChatSyncService.autoSync(user.id)
                console.log('[SYNC DEBUG] Client-side auto-sync completed')
                
                // Refresh chats list after sync to show downloaded chats
                const refreshedChats = await chatService.getAllChats()
                setChats(refreshedChats)
                console.log('[SYNC DEBUG] UI refreshed with downloaded chats')
              }
            }
          } catch (error) {
            console.error('[SYNC DEBUG] Auto-sync error:', error)
          }
        }
        
        const allChats = await chatService.getAllChats()
        setChats(allChats)

        // Select the first chat if available
        if (allChats.length > 0 && !selectedChat) {
          setSelectedChat(allChats[0])
        }

        // Load selected model from localStorage
        const storedModel = localStorage.getItem('selectedModel')
        console.log('Loading model from localStorage:', storedModel)
        if (storedModel) {
          console.log('Setting model to:', storedModel)
          setSelectedModel(storedModel)
        }
        setIsModelLoaded(true)
      } catch (error) {
        console.error('Failed to load chats:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadChats()
  }, [])

  // Update document title when selectedChat changes
  useEffect(() => {
    if (selectedChat) {
      document.title = `${selectedChat.title} - ReChat`
    } else {
      document.title = 'ReChat'
    }
  }, [selectedChat])

  // Save selected model to localStorage (only after initial load)
  useEffect(() => {
    if (isModelLoaded) {
      console.log('Saving model to localStorage:', selectedModel)
      localStorage.setItem('selectedModel', selectedModel)
    }
  }, [selectedModel, isModelLoaded])

  // Load branch information when selected chat changes
  useEffect(() => {
    const loadBranchInfo = async () => {
      if (!selectedChat) {
        setBranches([])
        setParentChat(undefined)
        return
      }

      try {
        // Load branches of current chat
        const chatBranches = await chatService.getChatBranches(selectedChat.id)
        setBranches(chatBranches)

        // Load parent chat if this is a branch
        if (selectedChat.parentChatId) {
          const parent = await chatService.getParentChat(selectedChat.id)
          setParentChat(parent)
        } else {
          setParentChat(undefined)
        }
      } catch (error) {
        console.error('Failed to load branch info:', error)
      }
    }

    loadBranchInfo()
  }, [selectedChat])

  // Create a new chat
  const handleNewChat = async () => {
    try {
      const newChat = await chatService.createChat('New Chat')
      const updatedChats = await chatService.getAllChats()
      setChats(updatedChats)
      setSelectedChat(newChat)
    } catch (error) {
      console.error('Failed to create new chat:', error)
    }
  }

  // Delete a chat
  const handleDeleteChat = async (chatId: string) => {
    try {
      await chatService.deleteChat(chatId)
      const updatedChats = await chatService.getAllChats()
      setChats(updatedChats)
      
      // If the deleted chat was selected, clear selection
      if (selectedChat?.id === chatId) {
        setSelectedChat(updatedChats.length > 0 ? updatedChats[0] : null)
      }
      
      setChatToDelete(null)
    } catch (error) {
      console.error('Failed to delete chat:', error)
    }
  }

  // Generate an image
  const handleGenerateImage = async () => {
    if (!message.trim() || !selectedChat || isStreaming) return
    
    // Check if user is logged in
    if (!user) {
      alert('Please sign in to use the AI image generation functionality.')
      return
    }
    
    let assistantMessageId: any = null
    
    try {
      const prompt = message
      setMessage('')
      setIsStreaming(true)
      
      // Add user message for the image prompt
      await chatService.addMessage(selectedChat.id, `${prompt}`, 'user')
      
      // Get updated chat with user message
      let updatedChat = await chatService.getChatById(selectedChat.id)
      if (updatedChat) {
        setSelectedChat(updatedChat)
      }
      
      // Create a placeholder assistant message
      assistantMessageId = await chatService.addMessage(
        selectedChat.id,
        'Generating image...',
        'assistant'
      )
      
      // Get custom API key from localStorage
      const customApiKey = localStorage.getItem('openai_api_key')
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      
      // Add custom API key to headers if available
      if (customApiKey) {
        headers['x-openai-api-key'] = customApiKey
      }
      
      const response = await fetch('/api/image', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: prompt,
          model: 'gpt-image-1',
          size: 'auto',
          quality: 'low'
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate image')
      }
      
      // Check if response is base64 text or JSON (error)
      const contentType = response.headers.get('content-type')
      
      if (contentType && contentType.includes('text/plain')) {
        // Response is base64 text, convert to data URL
        const base64Data = await response.text()
        console.log('Base64 data:', base64Data)
        
        // Check if base64Data is valid and not empty
        if (!base64Data || base64Data.trim() === '') {
          throw new Error('Received empty image data from server')
        }
        
        const imageDataUrl = `data:image/png;base64,${base64Data}`
        
        // Update the assistant message with just the image data URL
        await chatService.updateMessage(
          selectedChat.id,
          assistantMessageId.id,
          imageDataUrl
        )
        
        // Refresh the chat
        const refreshedChat = await chatService.getChatById(selectedChat.id)
        if (refreshedChat) {
          setSelectedChat(refreshedChat)
        }
        
        // Auto-upload to server if user is logged in
        if (user?.id) {
          try {
            console.log('[AUTO-UPLOAD] Triggering upload after image generation')
            await ChatSyncService.syncToServer(user.id)
            console.log('[AUTO-UPLOAD] Upload completed successfully')
          } catch (error) {
            console.error('[AUTO-UPLOAD] Upload failed:', error)
            // Don't throw error, just log it
          }
        }
      } else {
        throw new Error('No image data received')
      }
      
    } catch (error) {
      console.error('Image generation error:', error)
      
      // Update the assistant message with error if assistantMessageId exists
      if (assistantMessageId && selectedChat) {
        try {
          await chatService.updateMessage(
            selectedChat.id,
            assistantMessageId.id,
            `Sorry, I couldn't generate the image. Error: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
          
          // Refresh the chat
          const refreshedChat = await chatService.getChatById(selectedChat.id)
          if (refreshedChat) {
            setSelectedChat(refreshedChat)
          }
        } catch (updateError) {
          console.error('Failed to update error message:', updateError)
        }
      }
    } finally {
      setIsStreaming(false)
    }
  }

  // Send a message
  const handleSendMessage = async (attachments?: { name: string; type: string; url: string }[]) => {
    if (!message.trim() || !selectedChat || isStreaming) return
    
    try {
      const userMessage = message
      setMessage('')
      
      // Generate title if this is the first message (chat title is still 'New Chat')
      console.log('Title generation check:', {
        chatTitle: selectedChat.title,
        messageCount: selectedChat.messages.length,
        shouldGenerate: selectedChat.title === 'New Chat' && selectedChat.messages.length === 0
      })
      
      if (selectedChat.title === 'New Chat' && selectedChat.messages.length === 0) {
        console.log('Starting title generation for message:', userMessage)
        try {
          const titleResponse = await fetch('/api/generate-title', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: userMessage
            })
          })
          
          console.log('Title API response status:', titleResponse.status)
          
          if (titleResponse.ok) {
            const reader = titleResponse.body?.getReader()
            if (reader) {
              let generatedTitle = ''
              
              while (true) {
                const { done, value } = await reader.read()
                if (done) break
                
                const chunk = new TextDecoder().decode(value)
                generatedTitle += chunk
              }
              
              console.log('Raw generated title:', generatedTitle)
              
              // Clean up the title (remove quotes, trim, limit length)
              generatedTitle = generatedTitle.replace(/["']/g, '').trim()
              if (generatedTitle.length > 50) {
                generatedTitle = generatedTitle.substring(0, 50) + '...'
              }
              
              console.log('Cleaned title:', generatedTitle)
              
              if (generatedTitle) {
                await chatService.updateChatTitle(selectedChat.id, generatedTitle)
                console.log('Title updated successfully:', generatedTitle)
                
                // Update the selected chat with new title
                const updatedChatWithTitle = await chatService.getChatById(selectedChat.id)
                if (updatedChatWithTitle) {
                  setSelectedChat(updatedChatWithTitle)
                }
                
                // Update the chat in the list immediately
                const updatedChats = await chatService.getAllChats()
                setChats(updatedChats)
              } else {
                console.log('Generated title was empty after cleanup')
              }
            } else {
              console.log('No reader available for title response')
            }
          } else {
            console.error('Title API request failed with status:', titleResponse.status)
          }
        } catch (titleError) {
          console.error('Failed to generate title:', titleError)
          // Continue without title generation if it fails
        }
      }
      
      // Use the reusable sendMessageToAPI function
      await sendMessageToAPI(userMessage, selectedChat, selectedModel, attachments)
      
    } catch (error) {
      console.error('Failed to send message:', error)
      setIsStreaming(false)
    }
  }

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Send message to API (reusable function)
  const sendMessageToAPI = async (messageContent: string, chat: Chat, modelId: string, attachments?: { name: string; type: string; url: string }[]) => {
    // Check if user is logged in
    if (!user) {
      alert('Please sign in to use the AI chat functionality.')
      return
    }
    
    let assistantMessageId: any = null
    
    try {
      setIsStreaming(true)
      
      // Add user message with attachments
      await chatService.addMessage(chat.id, messageContent, 'user', attachments)
      
      // Get updated chat with user message
      let updatedChat = await chatService.getChatById(chat.id)
      if (updatedChat) {
        setSelectedChat(updatedChat)
      }
      
      // Create a placeholder assistant message that we'll stream into
      assistantMessageId = await chatService.addMessage(
        chat.id,
        '',
        'assistant'
      )
      
      // Get API key from localStorage
      const apiKey = localStorage.getItem('openai_api_key')
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }
      
      if (apiKey) {
        headers['x-openrouter-api-key'] = apiKey
      }
      
      // Start the resumable stream
      const response = await fetch('/api/stream/start', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          chatId: chat.id,
          messageId: assistantMessageId.id,
          modelId: modelId,
          messages: updatedChat?.messages || []
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }
      
      const { streamId } = await response.json()
      
      // Resume the stream to start receiving content
      const resumeResponse = await fetch(`/api/stream/resume/${streamId}`)
      
      if (!resumeResponse.ok) {
        throw new Error(`HTTP error! status: ${resumeResponse.status}`)
      }
      
      const reader = resumeResponse.body?.getReader()
      if (!reader) {
        throw new Error('No reader available')
      }
      
      let accumulatedContent = ''
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }
        
        const chunk = new TextDecoder().decode(value)
        accumulatedContent += chunk
        
        // Update the assistant message in real-time
        await chatService.updateMessage(
          chat.id,
          assistantMessageId.id,
          accumulatedContent
        )
        
        // Refresh the chat to show the updated message
        const currentChat = await chatService.getChatById(chat.id)
        if (currentChat) {
          setSelectedChat(currentChat)
        }
      }
      
    } catch (streamError) {
      console.error('Streaming error:', streamError)
      // Update with error message if assistantMessageId exists
      if (assistantMessageId) {
        await chatService.updateMessage(
          chat.id,
          assistantMessageId.id,
          'Sorry, there was an error processing your request. Please try again.'
        )
      }
    } finally {
      setIsStreaming(false)
    }
    
    // Final refresh
    const finalChat = await chatService.getChatById(chat.id)
    if (finalChat) {
      setSelectedChat(finalChat)
      
      // Update the chat in the list
      const updatedChats = await chatService.getAllChats()
      setChats(updatedChats)
      
      // Auto-upload after assistant message completion
      if (user?.id) {
        try {
          console.log('[AUTO-UPLOAD] Triggering upload after assistant message')
          const { ChatSyncService } = await import('./lib/chat-sync')
          await ChatSyncService.syncToServer(user.id)
          console.log('[AUTO-UPLOAD] Upload completed successfully')
        } catch (uploadError) {
          console.error('[AUTO-UPLOAD] Upload failed:', uploadError)
        }
      }
    }
  }



  // Handle resending a message
  const handleResendMessage = async (messageId: string) => {
    if (!selectedChat || isStreaming) return

    try {
      // Find the message to resend
      const messageToResend = selectedChat.messages.find(msg => msg.id === messageId)
      if (!messageToResend || messageToResend.role !== 'user') {
        console.error('Message not found or not a user message')
        return
      }

      // Delete the message and all messages after it
      await chatService.deleteMessagesFromPoint(selectedChat.id, messageId)

      // Get the updated chat
      const updatedChat = await chatService.getChatById(selectedChat.id)
      if (updatedChat) {
        setSelectedChat(updatedChat)
      }

      // Resend the message content with attachments
      await sendMessageToAPI(
        messageToResend.content, 
        updatedChat || selectedChat, 
        selectedModel,
        messageToResend.attachments?.map(attachment => ({
          ...attachment,
          url: attachment.url || '' // Ensure url is always a string
        }))
      )

      // Update the chats list
      const updatedChats = await chatService.getAllChats()
      setChats(updatedChats)
    } catch (error) {
      console.error('Failed to resend message:', error)
    }
  }

  // Handle creating a branch
  const handleCreateBranch = async (fromMessageId?: string) => {
    if (!selectedChat) return

    try {
      let branchChat: Chat
      let shouldTriggerAI = false
      
      if (fromMessageId) {
        // Find the message to check if it's from user
        const fromMessage = selectedChat.messages.find(msg => msg.id === fromMessageId)
        if (fromMessage && fromMessage.role === 'user') {
          shouldTriggerAI = true
        }
        
        // Create branch from specific message
        branchChat = await chatService.createBranch(selectedChat.id, fromMessageId)
      } else {
        // Create branch from current state
        const lastMessage = selectedChat.messages[selectedChat.messages.length - 1]
        if (lastMessage) {
          if (lastMessage.role === 'user') {
            shouldTriggerAI = true
          }
          branchChat = await chatService.createChat(`${selectedChat.title} (Branch)`, selectedChat.id)
        } else {
          // No messages, create empty branch
          branchChat = await chatService.createChat(`${selectedChat.title} (Branch)`, selectedChat.id)
        }
      }
      
      // Switch to the new branch
      setSelectedChat(branchChat)
      // Refresh chats list
      const updatedChats = await chatService.getAllChats()
      setChats(updatedChats)
      
      // If branching from a user message, automatically trigger AI response
      if (shouldTriggerAI) {
        // Wait a bit for the UI to update, then trigger AI
        setTimeout(async () => {
          let assistantMessageId: any = null
          
          try {
            setIsStreaming(true)
            
            // Create a placeholder assistant message that we'll stream into
            assistantMessageId = await chatService.addMessage(
              branchChat.id,
              '',
              'assistant'
            )
            
            // Use resumable streaming for branch
            const apiKey = localStorage.getItem('openai_api_key')
            
            const headers: Record<string, string> = {
              'Content-Type': 'application/json'
            }
            
            if (apiKey) {
              headers['x-openrouter-api-key'] = apiKey
            }
            
            // Start the resumable stream
            const response = await fetch('/api/stream/start', {
              method: 'POST',
              headers,
              body: JSON.stringify({
                chatId: branchChat.id,
                messageId: assistantMessageId.id,
                modelId: selectedModel,
                messages: branchChat.messages || []
              })
            })
            
            if (!response.ok) {
              const errorData = await response.json()
              throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
            }
            
            const { streamId } = await response.json()
            
            // Resume the stream to start receiving content
            const resumeResponse = await fetch(`/api/stream/resume/${streamId}`)
            
            if (!resumeResponse.ok) {
              throw new Error(`HTTP error! status: ${resumeResponse.status}`)
            }
            
            const reader = resumeResponse.body?.getReader()
            if (!reader) {
              throw new Error('No reader available')
            }
            
            let accumulatedContent = ''
            
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              
              const chunk = new TextDecoder().decode(value)
              accumulatedContent += chunk
              
              // Update the assistant message in real-time
              await chatService.updateMessage(
                branchChat.id,
                assistantMessageId.id,
                accumulatedContent
              )
              
              // Refresh the chat to show the updated message
              const currentChat = await chatService.getChatById(branchChat.id)
              if (currentChat) {
                setSelectedChat(currentChat)
              }
            }
            
          } catch (streamError) {
            console.error('Auto AI response error:', streamError)
            // Update with error message if assistantMessageId exists
            if (assistantMessageId) {
              try {
                await chatService.updateMessage(
                  branchChat.id,
                  assistantMessageId.id,
                  'Sorry, there was an error processing your request. Please try again.'
                )
              } catch (updateError) {
                console.error('Failed to update error message:', updateError)
              }
            }
          } finally {
            setIsStreaming(false)
            
            // Final refresh
            const finalChat = await chatService.getChatById(branchChat.id)
            if (finalChat) {
              setSelectedChat(finalChat)
              
              // Update the chat in the list
              const updatedChats = await chatService.getAllChats()
              setChats(updatedChats)
              
              // Auto-upload after assistant message completion in branch
              if (user?.id) {
                try {
                  console.log('[AUTO-UPLOAD] Triggering upload after branch assistant message')
                  const { ChatSyncService } = await import('./lib/chat-sync')
                  await ChatSyncService.syncToServer(user.id)
                  console.log('[AUTO-UPLOAD] Branch upload completed successfully')
                } catch (uploadError) {
                  console.error('[AUTO-UPLOAD] Failed to upload branch:', uploadError)
                  // Don't throw error to avoid disrupting the chat flow
                }
              }
            }
          }
        }, 100)
      }
    } catch (error) {
      console.error('Failed to create branch:', error)
    }
  }

  // Handle selecting a chat (including branches)
  const handleSelectChat = (chat: Chat) => {
    setSelectedChat(chat)
  }



  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-800 via-cyan-800 to-emerald-700 relative">
      {/* Mobile overlay */}
      <div 
        className={`fixed inset-0 bg-black transition-opacity duration-300 ease-in-out z-40 md:hidden ${
          isSidebarOpen ? 'opacity-50 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSidebarOpen(false)}
        onTouchStart={() => setSidebarOpen(false)}
      />
      
      <ChatSidebar
        chats={chats}
        selectedChat={selectedChat}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onDeleteChat={(chatId: string) => setChatToDelete(chatId)}
        isLoading={isLoading}
        isSidebarOpen={isSidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        <ChatHeader
           selectedChat={selectedChat}
           sidebarVisible={isSidebarOpen}
           setSidebarVisible={setSidebarOpen}
           showBranches={showBranches}
           setShowBranches={setShowBranches}
         />
        
        <div className="flex flex-1 min-h-0">
          <ChatMessages
          selectedChat={selectedChat}
          isStreaming={isStreaming}
          messageInput={message}
          setMessageInput={setMessage}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          handleSendMessage={handleSendMessage}
          handleGenerateImage={handleGenerateImage}
          handleKeyPress={handleKeyPress}
          onCreateBranch={handleCreateBranch}
          onResendMessage={handleResendMessage}
          user={user}
        />
          
          {showBranches && selectedChat && (
            <ChatBranches
              currentChat={selectedChat}
              branches={branches}
              parentChat={parentChat}
              onSelectChat={handleSelectChat}
              onCreateBranch={handleCreateBranch}
            />
          )}
        </div>
      </div>
      
      <DeleteChatDialog
        isOpen={!!chatToDelete}
        onClose={() => setChatToDelete(null)}
        onConfirm={() => {
          if (chatToDelete) {
            handleDeleteChat(chatToDelete)
          }
        }}
      />
    </div>
  )
}
