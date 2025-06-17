import { useState, useEffect, useCallback, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from "next/navigation";
import { useChatService } from '../../hooks/use-convex-feature';
import { ConvexChatService, useChatOperations } from '../../lib/convex-chat-service';
import { chatService } from "../../lib/database";
import type { Chat } from "../../types/chat";
import { ChatHeader } from "../ChatHeader";
import { ChatMessages } from "../ChatMessages";
import { ChatBranches } from "../ChatBranches";
import { Id } from "../../convex/_generated/dataModel";

interface ChatAreaContainerProps {
  selectedChatId?: string;
  isSidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export function ChatAreaContainer({ 
  selectedChatId, 
  isSidebarOpen, 
  setSidebarOpen 
}: ChatAreaContainerProps) {
  const { user } = useUser();
  const { isConvexEnabled, isLoading: serviceLoading } = useChatService();
  const router = useRouter();
  
  // Memoize userId to prevent unnecessary re-renders
  const userId = useMemo(() => user?.id, [user?.id]);
  
  // Chat area specific state
  const [message, setMessage] = useState("");
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [selectedModel, setSelectedModel] = useState("gemini-2.0-flash");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [showBranches, setShowBranches] = useState(false);
  const [branches, setBranches] = useState<Chat[]>([]);
  const [parentChat, setParentChat] = useState<Chat | undefined>(undefined);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  
  // Convex hooks (only used when Convex is enabled)
  const convexSelectedChatData = ConvexChatService.useGetChat(
    isConvexEnabled && selectedChatId ? selectedChatId as Id<"chats"> : undefined
  );
  const chatOperations = useChatOperations(isConvexEnabled ? userId : undefined);
  
  // Get messages based on service type (memoized)
  const messages = useMemo(() => {
    return isConvexEnabled
      ? (convexSelectedChatData?.messages?.map(ConvexChatService.convertConvexMessageToMessage) || [])
      : selectedChat?.messages || [];
  }, [isConvexEnabled, convexSelectedChatData?.messages, selectedChat?.messages]);
  
  // Update selectedChat with messages and title from Convex
  const selectedChatWithMessages = useMemo(() => {
    if (!selectedChat) return null;
    
    if (isConvexEnabled) {
      return {
        ...selectedChat,
        messages,
        title: convexSelectedChatData?.title || selectedChat.title
      };
    }
    
    return selectedChat;
  }, [selectedChat, isConvexEnabled, messages, convexSelectedChatData?.title]);
  
  // Load selected model from localStorage on mount
  useEffect(() => {
    const storedModel = localStorage.getItem('selectedModel');
    console.log('Loading model from localStorage:', storedModel);
    if (storedModel) {
      console.log('Setting model to:', storedModel);
      setSelectedModel(storedModel);
    }
    setIsModelLoaded(true);
  }, []);
  
  // Save selected model to localStorage (only after initial load)
  useEffect(() => {
    if (isModelLoaded) {
      console.log('Saving model to localStorage:', selectedModel);
      localStorage.setItem('selectedModel', selectedModel);
    }
  }, [selectedModel, isModelLoaded]);
  
  // Update selected chat when selectedChatId changes
  useEffect(() => {
    if (!selectedChatId) {
      setSelectedChat(null);
      return;
    }
    
    const loadChat = async () => {
      if (isConvexEnabled) {
        // For Convex, create a basic chat object - messages will be loaded via hooks
        setSelectedChat({ id: selectedChatId, title: 'Loading...', messages: [] });
      } else {
        // For legacy system, load the full chat with messages
        try {
          const chatWithMessages = await chatService.getChatById(selectedChatId);
          if (chatWithMessages) {
            setSelectedChat(chatWithMessages);
          } else {
            setSelectedChat({ id: selectedChatId, title: 'Chat not found', messages: [] });
          }
        } catch (error) {
          console.error('Failed to load chat messages:', error);
          setSelectedChat({ id: selectedChatId, title: 'Error loading chat', messages: [] });
        }
      }
    };
    
    loadChat();
  }, [selectedChatId, isConvexEnabled]);
  
  // Debug logging
  useEffect(() => {
    if (selectedChatWithMessages) {
      console.log('Selected chat with messages:', selectedChatWithMessages);
      console.log('Messages count:', selectedChatWithMessages.messages?.length || 0);
      console.log('Messages:', selectedChatWithMessages.messages);
    }
  }, [selectedChatWithMessages]);
  
  // Send message
  const sendMessage = useCallback(async (content: string, role: "user" | "assistant" = "user", attachments?: { name: string; type: string; url: string }[]) => {
    if (!selectedChat || !userId || isSending) return;
    
    // Use the correct chat data with up-to-date messages
    const currentChat = selectedChatWithMessages || selectedChat;
    const currentMessageCount = currentChat.messages?.length || 0;
    
    console.log('[TITLE DEBUG] sendMessage called with:', {
      role,
      content: content.substring(0, 50) + '...',
      chatTitle: currentChat.title,
      messageCount: currentMessageCount,
      chatId: currentChat.id
    });
    
    setIsSending(true);
    try {
      // Check if we should generate title BEFORE adding the message
      const shouldGenerateTitle = role === 'user' && currentChat.title === 'New Chat' && currentMessageCount === 0;
      
      console.log('[TITLE DEBUG] Title generation check:', {
        shouldGenerateTitle,
        role,
        chatTitle: currentChat.title,
        messageCount: currentMessageCount
      });
      
      if (isConvexEnabled) {
        await chatOperations.sendMessage(selectedChat.id as Id<"chats">, content, role, attachments);
        // The UI will automatically update via Convex reactivity
      } else {
        await chatService.addMessage(selectedChat.id, content, role, attachments);
        
        // Get updated chat
        const updatedChat = await chatService.getChatById(selectedChat.id);
        if (updatedChat) {
          setSelectedChat(updatedChat);
        }
        
        // Sync to server
        try {
          const { ChatSyncService } = await import('../../lib/chat-sync');
          await ChatSyncService.uploadAfterMessage(selectedChat.id, userId);
        } catch (error) {
          console.warn('Failed to sync message:', error);
        }
      }
      
      // Generate title AFTER adding the message, but only if this was the first user message
      if (shouldGenerateTitle) {
        console.log('Starting title generation for message:', content);
        try {
          if (isConvexEnabled) {
            await generateTitleConvex(selectedChat.id, content);
          } else {
            await generateTitle(selectedChat.id, content);
          }
        } catch (error) {
          console.error('Failed to generate title:', error);
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  }, [selectedChat, selectedChatWithMessages, userId, isSending, isConvexEnabled, chatOperations]);
  
  // Hook for AI response generation
  const generateAIResponseAction = ConvexChatService.useGenerateAIResponse();
  
  // Hook for title generation
  const generateTitleAction = ConvexChatService.useGenerateTitle();
  
  // Generate AI response using Convex
  const generateAIResponseConvex = useCallback(async (chatId: string, userMessage: string, attachments?: { name: string; type: string; url: string }[]) => {
    if (!userId) return;
    
    try {
      setIsStreaming(true);
      
      // Use the Convex action to generate AI response
      await generateAIResponseAction({
          chatId: chatId as Id<"chats">,
          userId: userId,
          userMessage: userMessage,
          modelId: selectedModel,
          attachments: attachments,
        });
      
      // The UI will automatically update via Convex reactivity
    } catch (error) {
      console.error('Failed to generate AI response:', error);
      // Add error message to chat
      await chatOperations.sendMessage(
        chatId as Id<"chats">, 
        `Sorry, there was an error generating the AI response: ${error instanceof Error ? error.message : 'Unknown error'}`, 
        "assistant"
      );
    } finally {
      setIsStreaming(false);
    }
  }, [userId, chatOperations, selectedModel, generateAIResponseAction]);
  
  // Generate title using Convex
  const generateTitleConvex = useCallback(async (chatId: string, firstMessage: string) => {
    if (!userId) return;
    
    try {
      // Use the Convex action to generate title
      const title = await generateTitleAction({
          chatId: chatId as Id<"chats">,
          userId: userId,
          firstMessage: firstMessage,
        });
      
      console.log('Generated title:', title);
      // The UI will automatically update via Convex reactivity
    } catch (error) {
      console.error('Failed to generate title:', error);
    }
  }, [userId, generateTitleAction]);
  
  // Generate AI response using legacy system
  const generateAIResponse = useCallback(async (chatId: string, userMessage: string, attachments?: { name: string; type: string; url: string }[]) => {
    if (!userId) return;
    
    try {
      setIsStreaming(true);
      setStreamingMessage(""); // Reset streaming message
      
      const response = await fetch('/api/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId,
          message: userMessage,
          model: selectedModel,
          attachments: attachments,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No reader available');
      }
      
      let assistantMessage = '';
      let assistantMessageId: string | null = null;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              break;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                assistantMessage += parsed.content;
                
                // Update streaming message for real-time display
                setStreamingMessage(assistantMessage);
                
                // Add assistant message if not already added
                if (!assistantMessageId) {
                  const message = await chatService.addMessage(chatId, assistantMessage, 'assistant');
                  assistantMessageId = message.id;
                } else {
                  // Update existing assistant message
                  await chatService.updateMessage(chatId, assistantMessageId, assistantMessage);
                }
                
                // Get updated chat
                const updatedChat = await chatService.getChatById(chatId);
                if (updatedChat) {
                  setSelectedChat(updatedChat);
                }
              }
            } catch (e) {
              console.error('Failed to parse streaming data:', e);
            }
          }
        }
      }
      
      // Clear streaming message when done
      setStreamingMessage("");
      
      // Sync to server after completion
      try {
        const { ChatSyncService } = await import('../../lib/chat-sync');
        await ChatSyncService.uploadAfterMessage(chatId, userId);
      } catch (error) {
        console.warn('Failed to sync AI response:', error);
      }
    } catch (error) {
      console.error('Failed to generate AI response:', error);
    } finally {
      setIsStreaming(false);
    }
  }, [userId, selectedModel]);
  
  // Generate title for legacy system
  const generateTitle = useCallback(async (chatId: string, firstMessage: string) => {
    try {
      const response = await fetch('/api/generate-title', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: firstMessage,
        }),
      });
      
      if (response.ok) {
        // Handle streaming response
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Response body is not readable');
        }
        
        const decoder = new TextDecoder();
        let title = '';
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            title += decoder.decode(value, { stream: true });
          }
        } finally {
          reader.releaseLock();
        }
        
        // Clean up the title (remove any extra whitespace)
        title = title.trim();
        
        if (title) {
          await chatService.updateChatTitle(chatId, title);
          
          // Get updated chat
          const updatedChat = await chatService.getChatById(chatId);
          if (updatedChat) {
            setSelectedChat(updatedChat);
          }
          
          // Sync to server
          try {
            const { ChatSyncService } = await import('../../lib/chat-sync');
            if (userId) {
              await ChatSyncService.uploadAfterMessage(chatId, userId);
            }
          } catch (error) {
            console.warn('Failed to sync title update:', error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to generate title:', error);
    }
  }, [userId]);
  
  // Handle resend message
  const handleResendMessage = useCallback(async (messageId: string) => {
    if (!selectedChat || !selectedChat.messages) return;
    
    const messageIndex = selectedChat.messages.findIndex(msg => msg.id === messageId);
    if (messageIndex < 0 || messageIndex >= selectedChat.messages.length) return;
    
    const messageToResend = selectedChat.messages[messageIndex];
    if (messageToResend.role !== 'user') return;
    
    try {
      if (isConvexEnabled) {
        // For Convex, remove messages from the resend point onwards and resend
        const messagesToDelete = selectedChat.messages.slice(messageIndex + 1);
        for (const msg of messagesToDelete) {
          await chatOperations.removeMessage(msg.id as Id<"messages">);
        }
        
        // Generate new AI response
        await generateAIResponseConvex(selectedChat.id, messageToResend.content);
      } else {
        // For legacy system, remove messages from the resend point onwards
        if (messageIndex + 1 < selectedChat.messages.length) {
          const messagesToDelete = selectedChat.messages.slice(messageIndex + 1);
          for (const msg of messagesToDelete) {
            await chatService.deleteMessage(msg.id);
          }
        }
        
        // Get updated chat
        const updatedChat = await chatService.getChatById(selectedChat.id);
        if (updatedChat) {
          setSelectedChat(updatedChat);
        }
        
        // Generate new AI response
        await generateAIResponse(selectedChat.id, messageToResend.content);
        
        // Sync to server
        try {
          const { ChatSyncService } = await import('../../lib/chat-sync');
          if (userId) {
            await ChatSyncService.uploadAfterMessage(selectedChat.id, userId);
          }
        } catch (error) {
          console.warn('Failed to sync resend:', error);
        }
      }
    } catch (error) {
      console.error('Failed to resend message:', error);
    }
  }, [selectedChat, isConvexEnabled, chatOperations, generateAIResponseConvex, generateAIResponse, userId]);
  
  // Memoized callback for sending messages
  const handleSendMessageCallback = useCallback(async (attachments?: { name: string; type: string; url: string }[]) => {
    const content = message.trim();
    if (!content || !selectedChat) return;
    
    setMessage('');
    
    await sendMessage(content, 'user', attachments);
    
    // Auto-generate AI response
    if (isConvexEnabled) {
      await generateAIResponseConvex(selectedChat.id, content, attachments);
    } else {
      await generateAIResponse(selectedChat.id, content, attachments);
    }
  }, [message, selectedChat, sendMessage, isConvexEnabled, generateAIResponseConvex, generateAIResponse]);
  
  // Memoized callback for key press handling
  const handleKeyPressCallback = useCallback(async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && message.trim() && selectedChat) {
      e.preventDefault();
      const content = message.trim();
      if (!content) return;
      
      setMessage('');
      
      await sendMessage(content, 'user');
      
      // Auto-generate AI response
      if (isConvexEnabled) {
        await generateAIResponseConvex(selectedChat.id, content);
      } else {
        await generateAIResponse(selectedChat.id, content);
      }
    }
  }, [message, selectedChat, sendMessage, isConvexEnabled, generateAIResponseConvex, generateAIResponse]);
  
  // Memoized callback for branch selection
  const handleBranchSelect = useCallback((branch: Chat) => {
    setSelectedChat(branch);
    router.replace(`/chat/${branch.id}`);
    setShowBranches(false);
  }, [router]);
  
  // Memoized callback for create branch
  const handleCreateBranch = useCallback(() => {
    setShowBranches(false);
  }, []);
  
  // Memoized callback for showing branches
  const handleShowBranches = useCallback(() => {
    setShowBranches(true);
  }, []);
  
  if (serviceLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-lg">Loading chat interface...</div>
      </div>
    );
  }
  
  return (
    <div className="flex-1 flex flex-col">
      <ChatHeader
        selectedChat={selectedChatWithMessages}
        sidebarVisible={isSidebarOpen}
        setSidebarVisible={setSidebarOpen}
        showBranches={showBranches}
        setShowBranches={setShowBranches}
      />
      
      <ChatMessages
        selectedChat={selectedChatWithMessages}
        isStreaming={isStreaming}
        isSending={isSending}
        streamingMessage={streamingMessage}
        messageInput={message}
        setMessageInput={setMessage}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        onResendMessage={handleResendMessage}
        onCreateBranch={handleShowBranches}
        user={user}
        handleSendMessage={handleSendMessageCallback}
        handleKeyPress={handleKeyPressCallback}
      />
      
      {showBranches && selectedChatWithMessages && (
        <ChatBranches
          currentChat={selectedChatWithMessages}
          branches={branches}
          parentChat={parentChat}
          onSelectChat={handleBranchSelect}
          onCreateBranch={handleCreateBranch}
        />
      )}
    </div>
  );
}