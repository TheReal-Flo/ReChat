"use client";

import { useState, useCallback } from 'react';
import { useRouter } from "next/navigation";
import type { Chat } from "../../types/chat";
import { ChatSidebarContainer } from "./chat-sidebar-container";
import { ChatAreaContainer } from "./chat-area-container";

interface HybridChatInterfaceProps {
  initialChatId?: string;
}

export default function HybridChatInterface({ initialChatId }: HybridChatInterfaceProps) {
  const router = useRouter();
  
  // Shared state between sidebar and chat area
  const [selectedChatId, setSelectedChatId] = useState<string | undefined>(initialChatId);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  
  // Handle chat selection from sidebar
  const handleChatSelect = useCallback((chat: Chat) => {
    setSelectedChatId(chat.id);
  }, []);
  
  // Handle new chat creation from sidebar
  const handleNewChatCreated = useCallback((chatId: string) => {
    setSelectedChatId(chatId);
    router.replace(`/chat/${chatId}`);
  }, [router]);
  

  
  return (
    <div className="flex h-screen bg-background">
      <ChatSidebarContainer
        selectedChatId={selectedChatId}
        onChatSelect={handleChatSelect}
        onNewChatCreated={handleNewChatCreated}
      />
      
      <ChatAreaContainer
        selectedChatId={selectedChatId}
        isSidebarOpen={isSidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />
    </div>
  );
}
