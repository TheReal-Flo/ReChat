import HybridChatInterface from '../../../components/chat/hybrid-chat-interface'

export default async function ChatPage({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await params;
  
  // Handle 'new' route as no initial chat ID
  const initialChatId = chatId === 'new' ? undefined : chatId;
  
  return <HybridChatInterface initialChatId={initialChatId} />
}