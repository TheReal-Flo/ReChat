"use client";

import { useUser } from '@clerk/nextjs';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from "next/navigation";
import { useChatService } from '../../hooks/use-convex-feature';
import { ConvexChatService, useChatOperations } from '../../lib/convex-chat-service';
import { chatService } from "../../lib/database";
import type { Chat } from "../../types/chat";
import { ChatSidebar } from "../ChatSidebar";
import { ChatHeader } from "../ChatHeader";
import { ChatMessages } from "../ChatMessages";
import { DeleteChatDialog } from "../DeleteChatDialog";
import { ChatBranches } from "../ChatBranches";
import { Id } from "../../convex/_generated/dataModel";

interface HybridChatInterfaceProps {
  initialChatId?: string;
}

export default function HybridChatInterface({ initialChatId }: HybridChatInterfaceProps) {
  const { user } = useUser();
  const { isConvexEnabled, isLoading: serviceLoading } = useChatService();
  const router = useRouter();
  
  // Memoize userId to prevent unnecessary re-renders
  const userId = useMemo(() => user?.id, [user?.id]);
  
  // Shared state
  const [message, setMessage] = useState("");
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [selectedModel, setSelectedModel] = useState("gemini-2.0-flash");
  const [isLoading, setIsLoading] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  const [showBranches, setShowBranches] = useState(false);
  const [branches, setBranches] = useState<Chat[]>([]);
  const [parentChat, setParentChat] = useState<Chat | undefined>(undefined);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  
  // Legacy state
  const [legacyChats, setLegacyChats] = useState<Chat[]>([]);
  
  // Convex hooks (only used when Convex is enabled)
  const convexChats = ConvexChatService.useGetChats(isConvexEnabled ? userId : undefined);
  const convexSelectedChatData = ConvexChatService.useGetChat(
    isConvexEnabled && selectedChat ? selectedChat.id as Id<"chats"> : undefined
  );
  const chatOperations = useChatOperations(isConvexEnabled ? userId : undefined);
  
  // Get chats based on service type (memoized)
  const chats = useMemo(() => {
    return isConvexEnabled 
      ? (convexChats?.map(ConvexChatService.convertConvexChatToChat) || [])
      : legacyChats;
  }, [isConvexEnabled, convexChats, legacyChats]);
  
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
  
  // Debug logging
  useEffect(() => {
    if (selectedChatWithMessages) {
      console.log('Selected chat with messages:', selectedChatWithMessages);
      console.log('Messages count:', selectedChatWithMessages.messages?.length || 0);
      console.log('Messages:', selectedChatWithMessages.messages);
    }
  }, [selectedChatWithMessages]);
  
  // Initialize data based on service type
  useEffect(() => {
    if (serviceLoading) return;
    
    const initializeData = async () => {
      try {
        setIsLoading(true);
        
        if (isConvexEnabled) {
          // Convex initialization - data is automatically loaded via hooks
          console.log('[CONVEX] Using Convex for chat synchronization');
        } else {
          // Legacy initialization
          await chatService.initializeSampleData();
          
          // Initialize ChatSyncService
      try {
        const { ChatSyncService } = await import('../../lib/chat-sync');
        await ChatSyncService.initialize(userId);
      } catch (error) {
        console.warn('Failed to initialize ChatSyncService:', error);
      }
          
          // Auto-sync if user is logged in
          if (userId) {
            try {
              console.log('[SYNC DEBUG] Triggering auto-sync for user:', userId);
              const response = await fetch('/api/sync', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId: userId }),
              });
              
              if (response.ok) {
                console.log('[SYNC DEBUG] Auto-sync completed successfully');
              }
            } catch (error) {
              console.warn('[SYNC DEBUG] Auto-sync failed:', error);
            }
          }
          
          // Load legacy chats
          const loadedChats = await chatService.getAllChats();
          setLegacyChats(loadedChats);
        }
        
        // Load selected model from localStorage
        const storedModel = localStorage.getItem('selectedModel');
        console.log('Loading model from localStorage:', storedModel);
        if (storedModel) {
          console.log('Setting model to:', storedModel);
          setSelectedModel(storedModel);
        }
        setIsModelLoaded(true);
      } catch (error) {
        console.error('Failed to initialize chat data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    initializeData();
  }, [userId, isConvexEnabled, serviceLoading]);
  
  // Save selected model to localStorage (only after initial load)
  useEffect(() => {
    if (isModelLoaded) {
      console.log('Saving model to localStorage:', selectedModel);
      localStorage.setItem('selectedModel', selectedModel);
    }
  }, [selectedModel, isModelLoaded]);
  
  // Start auto-sync for legacy system
  useEffect(() => {
    if (!isConvexEnabled && userId) {
      const startAutoSync = async () => {
        try {
          const { ChatSyncService } = await import('../../lib/chat-sync');
          ChatSyncService.startAutoSync(userId);
        } catch (error) {
          console.warn('Failed to start auto-sync:', error);
        }
      };
      
      startAutoSync();
    }
  }, [userId, isConvexEnabled]);

  // Handle chat selection from URL and initial load (combined for efficiency)
  useEffect(() => {
    if (chats.length === 0) return;
    
    // Check if we need to update the selected chat
    let targetChat: Chat | null = null;
    let shouldUpdateUrl = false;
    
    if (initialChatId) {
      // Try to find the chat from URL
      targetChat = chats.find(chat => chat.id === initialChatId) || null;
      
      // If URL chat not found and no chat selected, fallback to first chat
      if (!targetChat && !selectedChat && chats.length > 0) {
        targetChat = chats[0];
        shouldUpdateUrl = true;
      }
    } else {
      // No URL chat ID (from '/chat/new'), select first available chat
      if (chats.length > 0) {
        targetChat = chats[0];
        shouldUpdateUrl = true;
      }
    }
    
    // Update selected chat if needed
    if (targetChat && targetChat.id !== selectedChat?.id) {
      setSelectedChat(targetChat);
      
      // Update URL if necessary and if the path actually needs changing
      const currentPath = window.location.pathname;
      const targetPath = `/chat/${targetChat.id}`;
      // if (shouldUpdateUrl && currentPath !== targetPath) {
      //   router.replace(targetPath);
      // }
    }
  }, [chats, selectedChat?.id, initialChatId, router]);
  
  // Legacy chat loading effect
  useEffect(() => {
    if (!isConvexEnabled && selectedChat && !selectedChat.messages) {
      // Load messages for legacy system
      const loadMessages = async () => {
        try {
          const chatWithMessages = await chatService.getChatById(selectedChat.id);
          if (chatWithMessages && chatWithMessages.messages) {
            setSelectedChat(chatWithMessages);
          }
        } catch (error) {
          console.error('Failed to load chat messages:', error);
        }
      };
      
      loadMessages();
    }
  }, [selectedChat, isConvexEnabled]);
  
  // Create new chat
  const createNewChat = useCallback(async (title: string = "New Chat") => {
    if (!userId) return null;
    
    try {
      if (isConvexEnabled) {
        const newChatId = await chatOperations.createNewChat(title);
        // Navigate to the new chat URL
        router.replace(`/chat/${newChatId}`);
        // The UI will automatically update via Convex reactivity
        return newChatId;
      } else {
        const newChat = await chatService.createChat(title);
        
        setLegacyChats(prev => [newChat, ...prev]);
        setSelectedChat(newChat);
        
        // Navigate to the new chat URL
        router.replace(`/chat/${newChat.id}`);
        
        // Sync to server
        try {
          const { ChatSyncService } = await import('../../lib/chat-sync');
          await ChatSyncService.uploadAfterMessage(newChat.id, userId);
        } catch (error) {
          console.warn('Failed to sync new chat:', error);
        }
        
        return newChat.id;
      }
    } catch (error) {
      console.error('Failed to create new chat:', error);
      return null;
    }
  }, [userId, isConvexEnabled, chatOperations, router, chatService, setLegacyChats, setSelectedChat]);
  
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
          setLegacyChats(prev => prev.map(chat => 
            chat.id === updatedChat.id ? updatedChat : chat
          ));
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
                  setLegacyChats(prev => prev.map(chat => 
                    chat.id === updatedChat.id ? updatedChat : chat
                  ));
                }
              }
            } catch (e) {
              console.error('Failed to parse streaming data:', e);
            }
          }
        }
      }
      
      // Sync to server after completion
      try {
        const { ChatSyncService } = await import('../../lib/chat-sync');
        await ChatSyncService.uploadAfterMessage(chatId, user.id);
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
            setLegacyChats(prev => prev.map(chat => 
              chat.id === updatedChat.id ? updatedChat : chat
            ));
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
          setLegacyChats(prev => prev.map(chat => 
            chat.id === updatedChat.id ? updatedChat : chat
          ));
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
  
  // Delete chat
  const deleteChat = useCallback(async (chatId: string) => {
    if (!userId) return;
    
    try {
      if (isConvexEnabled) {
        await chatOperations.removeChatPermanently(chatId as Id<"chats">);
        // The UI will automatically update via Convex reactivity
        if (selectedChat?.id === chatId) {
          setSelectedChat(null);
        }
      } else {
        await chatService.deleteChat(chatId);
        setLegacyChats(prev => prev.filter(chat => chat.id !== chatId));
        
        if (selectedChat?.id === chatId) {
          setSelectedChat(null);
        }
        
        // Sync to server
        try {
          const { ChatSyncService } = await import('../../lib/chat-sync');
          await ChatSyncService.uploadAfterMessage(chatId, user.id);
        } catch (error) {
          console.warn('Failed to sync chat deletion:', error);
        }
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
    }
  }, [userId, isConvexEnabled, chatOperations, selectedChat, chatService, setLegacyChats, setSelectedChat, user?.id]);
  
  // Toggle pin chat
  const togglePinChat = useCallback(async (chatId: string) => {
    if (!userId) return;
    
    try {
      if (isConvexEnabled) {
        await chatOperations.togglePinChat(chatId as Id<"chats">);
        // The UI will automatically update via Convex reactivity
      } else {
        await chatService.togglePinChat(chatId);
        const updatedChat = await chatService.getChatById(chatId);
        if (updatedChat) {
          setLegacyChats(prev => prev.map(chat => 
            chat.id === updatedChat.id ? updatedChat : chat
          ));
          
          if (selectedChat?.id === chatId) {
            setSelectedChat(updatedChat);
          }
        }
        
        // Sync to server
        try {
          const { ChatSyncService } = await import('../../lib/chat-sync');
          await ChatSyncService.uploadAfterMessage(chatId, user.id);
        } catch (error) {
          console.warn('Failed to sync pin toggle:', error);
        }
      }
    } catch (error) {
      console.error('Failed to toggle pin status:', error);
    }
  }, [userId, isConvexEnabled, chatOperations, chatService, setLegacyChats, selectedChat, setSelectedChat, user?.id]);
  
  // Handle chat selection
  const handleChatSelect = useCallback(async (chat: Chat) => {
    // Update URL without causing navigation
    router.replace(`/chat/${chat.id}`);
    
    if (!isConvexEnabled) {
      // For legacy system, load messages first then set state once
      try {
        const chatWithMessages = await chatService.getChatById(chat.id);
        if (chatWithMessages) {
          setSelectedChat(chatWithMessages);
        } else {
          setSelectedChat(chat);
        }
      } catch (error) {
        console.error('Failed to load chat messages:', error);
        setSelectedChat(chat);
      }
    } else {
      // For Convex, just set the chat - messages will be loaded via hooks
      setSelectedChat(chat);
    }
  }, [isConvexEnabled, router]);

  // Memoized callback for sending messages
  const handleSendMessageCallback = useCallback(async (attachments?: { name: string; type: string; url: string }[]) => {
    const content = message.trim();
    if (!content) return;
    
    setMessage('');
    
    // Create new chat if none selected
    let chatToUse = selectedChatWithMessages;
    if (!selectedChatWithMessages) {
      const newChatId = await createNewChat();
      if (newChatId) {
        // Find the newly created chat from current chats
        const currentChats = isConvexEnabled 
          ? (convexChats?.map(ConvexChatService.convertConvexChatToChat) || [])
          : legacyChats;
        const newChat = currentChats.find(c => c.id === newChatId);
        if (newChat) {
          chatToUse = newChat;
          setSelectedChat(chatToUse);
        }
      }
    }
    
    if (chatToUse) {
      await sendMessage(content, 'user', attachments);
      
      // Auto-generate AI response
      if (isConvexEnabled) {
        await generateAIResponseConvex(chatToUse.id, content, attachments);
      } else {
        await generateAIResponse(chatToUse.id, content, attachments);
      }
    }
  }, [message, selectedChatWithMessages, createNewChat, isConvexEnabled, convexChats, legacyChats, sendMessage, generateAIResponseConvex, generateAIResponse]);

  // Memoized callback for key press handling
  const handleKeyPressCallback = useCallback(async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && message.trim()) {
      e.preventDefault();
      const content = message.trim();
      if (!content) return;
      
      setMessage('');
      
      // Create new chat if none selected
      let chatToUse = selectedChatWithMessages;
      if (!selectedChatWithMessages) {
        const newChatId = await createNewChat();
        if (newChatId) {
          // Find the newly created chat from current chats
          const currentChats = isConvexEnabled 
            ? (convexChats?.map(ConvexChatService.convertConvexChatToChat) || [])
            : legacyChats;
          const newChat = currentChats.find(c => c.id === newChatId);
          if (newChat) {
            chatToUse = newChat;
            setSelectedChat(chatToUse);
          }
        }
      }
      
      if (chatToUse) {
        await sendMessage(content, 'user');
        
        // Auto-generate AI response
        if (isConvexEnabled) {
          await generateAIResponseConvex(chatToUse.id, content);
        } else {
          await generateAIResponse(chatToUse.id, content);
        }
      }
    }
  }, [message, selectedChatWithMessages, createNewChat, isConvexEnabled, convexChats, legacyChats, sendMessage, generateAIResponseConvex, generateAIResponse]);

  // Memoized callback for delete chat
  const handleDeleteChat = useCallback((chatId: string) => {
    setChatToDelete(chatId);
  }, []);

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

  // Memoized callback for closing delete dialog
  const handleCloseDeleteDialog = useCallback(() => {
    setChatToDelete(null);
  }, []);

  // Memoized callback for confirming delete
  const handleConfirmDelete = useCallback(() => {
    if (chatToDelete) {
      deleteChat(chatToDelete);
      setChatToDelete(null);
    }
  }, [chatToDelete, deleteChat]);
    
  if (serviceLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading chat interface...</div>
      </div>
    );
  }
  
  return (
    <div className="flex h-screen bg-background">
      <ChatSidebar
        chats={chats}
        selectedChat={selectedChat}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onSelectChat={handleChatSelect}
        onNewChat={createNewChat}
        onDeleteChat={handleDeleteChat}
        onTogglePin={togglePinChat}
        isLoading={isLoading}
        isSidebarOpen={isSidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />
      
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
      </div>
      
      {chatToDelete && (
        <DeleteChatDialog
          isOpen={!!chatToDelete}
          onClose={handleCloseDeleteDialog}
          onConfirm={handleConfirmDelete}
        />
      )}
      
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
