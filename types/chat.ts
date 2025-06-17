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
  createdAt: Date // When the message was first created
  updatedAt: Date // When the message was last modified
}

export interface Chat {
  id: string
  title: string
  timestamp: Date
  messages: Message[]
  parentChatId?: string // Reference to parent chat if this is a branch
  branchFromMessageId?: string // Message ID where this branch started
  branches?: string[] // Array of child chat IDs that branched from this chat
  createdAt: Date // When the chat was first created
  updatedAt: Date // When the chat was last modified
  lastSyncedAt?: Date // When this chat was last synced with server
  pinned?: boolean // Whether the chat is pinned to the top
}

export interface SyncSettings {
  enabled: boolean
  autoUpload: boolean
  downloadInterval: number // in seconds
}

export interface SyncStatus {
  lastSyncTimestamp: Date
  pendingChanges: number
  isOnline: boolean
  syncEnabled: boolean
}
