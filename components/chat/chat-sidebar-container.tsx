import { useState, useEffect, useCallback, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from "next/navigation";
import { useChatService } from '../../hooks/use-convex-feature';
import { ConvexChatService, useChatOperations } from '../../lib/convex-chat-service';
import { chatService } from "../../lib/database";
import type { Chat } from "../../types/chat";
import { ChatSidebar } from "../ChatSidebar";
import { DeleteChatDialog } from "../DeleteChatDialog";
import { Id } from "../../convex/_generated/dataModel";

interface ChatSidebarContainerProps {
  selectedChatId?: string;
  onChatSelect: (chat: Chat) => void;
  onNewChatCreated: (chatId: string) => void;
}

export function ChatSidebarContainer({ 
  selectedChatId, 
  onChatSelect, 
  onNewChatCreated 
}: ChatSidebarContainerProps) {
  const { user } = useUser();
  const { isConvexEnabled, isLoading: serviceLoading } = useChatService();
  const router = useRouter();
  
  // Memoize userId to prevent unnecessary re-renders
  const userId = useMemo(() => user?.id, [user?.id]);
  
  // Sidebar-specific state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  
  // Legacy state
  const [legacyChats, setLegacyChats] = useState<Chat[]>([]);
  
  // Convex hooks (only used when Convex is enabled)
  const convexChats = ConvexChatService.useGetChats(isConvexEnabled ? userId : undefined);
  const chatOperations = useChatOperations(isConvexEnabled ? userId : undefined);
  
  // Get chats based on service type (memoized)
  const chats = useMemo(() => {
    return isConvexEnabled 
      ? (convexChats?.map(ConvexChatService.convertConvexChatToChat) || [])
      : legacyChats;
  }, [isConvexEnabled, convexChats, legacyChats]);
  
  // Find selected chat from chats list
  const selectedChat = useMemo(() => {
    return selectedChatId ? chats.find(chat => chat.id === selectedChatId) || null : null;
  }, [selectedChatId, chats]);
  
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
      } catch (error) {
        console.error('Failed to initialize chat data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    initializeData();
  }, [userId, isConvexEnabled, serviceLoading]);
  
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
  
  // Create new chat
  const createNewChat = useCallback(async (title: string = "New Chat") => {
    if (!userId) return null;
    
    try {
      if (isConvexEnabled) {
        const newChatId = await chatOperations.createNewChat(title);
        // Notify parent component about new chat
        onNewChatCreated(newChatId);
        return newChatId;
      } else {
        const newChat = await chatService.createChat(title);
        
        setLegacyChats(prev => [newChat, ...prev]);
        
        // Notify parent component about new chat
        onNewChatCreated(newChat.id);
        
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
  }, [userId, isConvexEnabled, chatOperations, onNewChatCreated]);
  
  // Delete chat
  const deleteChat = useCallback(async (chatId: string) => {
    if (!userId) return;
    
    try {
      if (isConvexEnabled) {
        await chatOperations.removeChatPermanently(chatId as Id<"chats">);
        // The UI will automatically update via Convex reactivity
      } else {
        await chatService.deleteChat(chatId);
        setLegacyChats(prev => prev.filter(chat => chat.id !== chatId));
        
        // Sync to server
        try {
          const { ChatSyncService } = await import('../../lib/chat-sync');
          await ChatSyncService.uploadAfterMessage(chatId, userId);
        } catch (error) {
          console.warn('Failed to sync chat deletion:', error);
        }
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
    }
  }, [userId, isConvexEnabled, chatOperations]);
  
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
        }
        
        // Sync to server
        try {
          const { ChatSyncService } = await import('../../lib/chat-sync');
          await ChatSyncService.uploadAfterMessage(chatId, userId);
        } catch (error) {
          console.warn('Failed to sync pin toggle:', error);
        }
      }
    } catch (error) {
      console.error('Failed to toggle pin status:', error);
    }
  }, [userId, isConvexEnabled, chatOperations]);
  
  // Handle chat selection
  const handleChatSelect = useCallback(async (chat: Chat) => {
    // Update URL and notify parent
    router.replace(`/chat/${chat.id}`);
    onChatSelect(chat);
  }, [router, onChatSelect]);
  
  // Memoized callback for delete chat
  const handleDeleteChat = useCallback((chatId: string) => {
    setChatToDelete(chatId);
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
  
  return (
    <>
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
      
      {chatToDelete && (
        <DeleteChatDialog
          isOpen={!!chatToDelete}
          onClose={handleCloseDeleteDialog}
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  );
}