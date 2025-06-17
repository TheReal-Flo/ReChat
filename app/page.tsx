import { redirect } from 'next/navigation'
import HybridChatInterface from '../components/chat/hybrid-chat-interface'

export default function Page() {
  // Redirect to a default chat route to prevent component remounting issues
  redirect('/chat/new')
}
