export interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
  attachments?: {
    name: string
    type: string
    url?: string
  }[]
  position?: number // Position in the conversation for branching
}

export interface Chat {
  id: string
  title: string
  timestamp: Date
  messages: Message[]
  parentChatId?: string // Reference to parent chat if this is a branch
  branchFromMessageId?: string // Message ID where this branch started
  branches?: string[] // Array of child chat IDs that branched from this chat
  updatedAt?: any // Include for timestamp comparison
}
