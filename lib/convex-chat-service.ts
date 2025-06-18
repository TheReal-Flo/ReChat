import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { useMutation, useQuery, useAction } from "convex/react";
import type { Chat, Message } from "../types/chat";

/**
 * Convex-based chat service that replaces the old PostgreSQL/Redis sync system
 * Provides real-time synchronization and automatic UI updates
 */
export class ConvexChatService {
  // ============ QUERY HOOKS ============
  
  /**
   * Get all chats for the current user with real-time updates
   */
  static useGetChats(userId: string | undefined) {
    return useQuery(
      api.chats.getUserChats,
      userId ? { userId } : "skip"
    );
  }
  
  /**
   * Get a specific chat with its messages with real-time updates
   */
  static useGetChat(chatId: Id<"chats"> | undefined, userId: string | undefined) {
    return useQuery(
      api.chats.getChatWithMessages,
      chatId && userId ? { chatId, userId } : "skip"
    );
  }
  
  /**
   * Get messages for a specific chat with real-time updates
   */
  static useGetChatMessages(chatId: Id<"chats"> | undefined, userId: string | undefined) {
    return useQuery(
      api.chats.getChatMessages,
      chatId && userId ? { chatId, userId } : "skip"
    );
  }
  
  // ============ MUTATION HOOKS ============
  
  /**
   * Create a new chat
   */
  static useCreateChat() {
    return useMutation(api.chats.createChat);
  }
  
  /**
   * Update an existing chat
   */
  static useUpdateChat() {
    return useMutation(api.chats.updateChat);
  }
  
  /**
   * Delete a chat (soft delete)
   */
  static useDeleteChat() {
    return useMutation(api.chats.deleteChat);
  }
  
  /**
   * Toggle pin status of a chat
   */
  static useTogglePinChat() {
    return useMutation(api.chats.togglePinChat);
  }
  
  /**
   * Add a message to a chat
   */
  static useAddMessage() {
    return useMutation(api.messages.addMessage);
  }
  
  /**
   * Generate AI response
   */
  static useGenerateAIResponse() {
    return useAction(api.messages.generateAIResponse);
  }
  
  /**
   * Generate title
   */
  static useGenerateTitle() {
    return useAction(api.messages.generateTitle);
  }
  
  /**
   * Update an existing message
   */
  static useUpdateMessage() {
    return useMutation(api.messages.updateMessage);
  }
  
  /**
   * Delete a message (soft delete)
   */
  static useDeleteMessage() {
    return useMutation(api.messages.deleteMessage);
  }

  /**
   * Get branches of a chat
   */
  static useGetChatBranches(chatId: Id<"chats"> | undefined, userId: string | undefined) {
    return useQuery(api.chats.getChatBranches, chatId && userId ? { chatId, userId } : "skip");
  }

  /**
   * Get parent chat of a branch
   */
  static useGetParentChat(chatId: Id<"chats"> | undefined, userId: string | undefined) {
    return useQuery(api.chats.getParentChat, chatId && userId ? { chatId, userId } : "skip");
  }
  
  // ============ UTILITY METHODS ============
  
  /**
   * Convert Convex chat data to the existing Chat interface
   */
  static convertConvexChatToChat(convexChat: any): Chat {
    return {
      id: convexChat._id,
      title: convexChat.title,
      timestamp: new Date(convexChat.timestamp),
      messages: convexChat.messages ? convexChat.messages.map((msg: any) => this.convertConvexMessageToMessage(msg)) : [],
      parentChatId: convexChat.parentChatId,
      branchFromMessageId: convexChat.branchFromMessageId,
      branches: convexChat.branches || [],
      createdAt: new Date(convexChat._creationTime),
      updatedAt: new Date(convexChat.timestamp),
      pinned: convexChat.pinned || false,
    };
  }
  
  /**
   * Convert Convex message data to the existing Message interface
   */
  static convertConvexMessageToMessage(convexMessage: any): Message {
    return {
      id: convexMessage._id,
      content: convexMessage.content,
      role: convexMessage.role,
      timestamp: new Date(convexMessage.timestamp),
      position: convexMessage.position,
      attachments: convexMessage.attachments,
      createdAt: new Date(convexMessage._creationTime),
      updatedAt: new Date(convexMessage.timestamp),
    };
  }
  
  /**
   * Convert existing Chat to Convex format for creation
   */
  static convertChatToConvexFormat(chat: Chat, userId: string) {
    return {
      userId,
      title: chat.title,
      parentChatId: chat.parentChatId,
      branchFromMessageId: chat.branchFromMessageId,
    };
  }
  
  /**
   * Convert existing Message to Convex format for creation
   */
  static convertMessageToConvexFormat(message: Message, chatId: Id<"chats">, userId: string) {
    return {
      chatId,
      userId,
      content: message.content,
      role: message.role as "user" | "assistant",
      position: message.position,
      attachments: message.attachments,
    };
  }
}

/**
 * Hook for managing chat operations with optimistic updates
 */
export function useChatOperations(userId: string | undefined) {
  const createChat = ConvexChatService.useCreateChat();
  const updateChat = ConvexChatService.useUpdateChat();
  const deleteChat = ConvexChatService.useDeleteChat();
  const togglePinChat = ConvexChatService.useTogglePinChat();
  const addMessage = ConvexChatService.useAddMessage();
  const updateMessage = ConvexChatService.useUpdateMessage();
  const deleteMessage = ConvexChatService.useDeleteMessage();
  const createBranchMutation = useMutation(api.chats.createBranch);
  
  const createNewChat = async (title: string, parentChatId?: string, branchFromMessageId?: string) => {
    if (!userId) throw new Error("User ID is required");
    
    return await createChat({
      userId,
      title,
      parentChatId,
      branchFromMessageId,
    });
  };
  
  const sendMessage = async (chatId: Id<"chats">, content: string, role: "user" | "assistant" = "user", attachments?: any) => {
    if (!userId) throw new Error("User ID is required");
    
    return await addMessage({
      chatId,
      userId,
      content,
      role,
      attachments,
    });
  };
  
  const updateChatTitle = async (chatId: Id<"chats">, title: string) => {
    if (!userId) throw new Error("User ID is required");
    return await updateChat({
      chatId,
      userId,
      title,
    });
  };
  
  const updateChatBranches = async (chatId: Id<"chats">, branches: string[]) => {
    if (!userId) throw new Error("User ID is required");
    return await updateChat({
      chatId,
      userId,
      branches,
    });
  };
  
  const editMessage = async (messageId: Id<"messages">, content: string, attachments?: any) => {
    if (!userId) throw new Error("User ID is required");
    return await updateMessage({
      messageId,
      userId,
      content,
      attachments,
    });
  };
  
  const removeChatPermanently = async (chatId: Id<"chats">) => {
    if (!userId) throw new Error("User ID is required");
    return await deleteChat({ chatId, userId });
  };
  
  const removeMessage = async (messageId: Id<"messages">) => {
    if (!userId) throw new Error("User ID is required");
    return await deleteMessage({ messageId, userId });
  };
  
  const toggleChatPin = async (chatId: Id<"chats">) => {
    if (!userId) throw new Error("User ID is required");
    return await togglePinChat({ chatId, userId });
  };

  const createBranch = async (parentChatId: string, fromMessageId: string, newTitle?: string) => {
    return await createBranchMutation({
      parentChatId: parentChatId as Id<"chats">,
      fromMessageId: fromMessageId as Id<"messages">,
      userId: userId!,
      newTitle,
    });
  };

  const getChatBranches = async (chatId: string) => {
    // For Convex, we'll need to handle this differently since hooks can't be called in async functions
    // This will be handled at the component level
    throw new Error("getChatBranches for Convex should be handled at component level using hooks");
  };

  const getParentChat = async (chatId: string) => {
    // For Convex, we'll need to handle this differently since hooks can't be called in async functions
    // This will be handled at the component level
    throw new Error("getParentChat for Convex should be handled at component level using hooks");
  };

  return {
    createNewChat,
    sendMessage,
    updateChatTitle,
    updateChatBranches,
    editMessage,
    removeChatPermanently,
    removeMessage,
    toggleChatPin: toggleChatPin,
    createBranch,
    getChatBranches,
    getParentChat,
  };
}

/**
 * Migration utilities for transitioning from the old system
 */
export class ConvexMigrationUtils {
  /**
   * Check if Convex is enabled via feature flag
   */
  static isConvexEnabled(): boolean {
    return process.env.NEXT_PUBLIC_USE_CONVEX === 'true';
  }
  
  /**
   * Get the appropriate chat service based on feature flag
   */
  static getChatService() {
    return this.isConvexEnabled() ? ConvexChatService : null;
  }
  
  /**
   * Migrate a single chat from local storage to Convex
   */
  static async migrateChatToConvex(chat: Chat, userId: string, createChatMutation: any) {
    const convexFormat = ConvexChatService.convertChatToConvexFormat(chat, userId);
    return await createChatMutation(convexFormat);
  }
  
  /**
   * Migrate messages from local storage to Convex
   */
  static async migrateMessagesToConvex(messages: Message[], chatId: Id<"chats">, userId: string, addMessageMutation: any) {
    const results = [];
    
    for (const message of messages) {
      const convexFormat = ConvexChatService.convertMessageToConvexFormat(message, chatId, userId);
      const result = await addMessageMutation(convexFormat);
      results.push(result);
    }
    
    return results;
  }
}