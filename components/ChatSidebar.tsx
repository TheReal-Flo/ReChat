import React, { memo, useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, Plus, Trash2, Settings as SettingsIcon, X, Pin } from "lucide-react"
import type { Chat } from "../types/chat"
import { TypewriterText } from "./TypewriterText"
import { Settings } from "./Settings"
import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from "@clerk/nextjs"

interface ChatSidebarProps {
  chats: Chat[]
  selectedChat: Chat | null
  searchQuery: string
  setSearchQuery: (query: string) => void
  onSelectChat: (chat: Chat) => void
  onNewChat: () => void
  onDeleteChat: (chatId: string) => void
  onTogglePin: (chatId: string) => void
  isLoading: boolean
  isSidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

const ChatSidebar = memo(function ChatSidebar({
  chats,
  selectedChat,
  searchQuery,
  setSearchQuery,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onTogglePin,
  isLoading,
  isSidebarOpen,
  setSidebarOpen
}: ChatSidebarProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const { isSignedIn, user } = useUser();
  
  const filteredChats = useMemo(() => 
    chats.filter((chat) => 
      chat.title.toLowerCase().includes(searchQuery.toLowerCase())
    ), [chats, searchQuery]
  )

  return (
    <div className={`${
      isSidebarOpen 
        ? 'translate-x-0' 
        : '-translate-x-full'
    } md:translate-x-0 md:relative fixed left-0 top-0 h-full w-80 max-w-[85vw] md:max-w-none transition-transform duration-300 ease-in-out flex flex-col min-h-0 overflow-hidden bg-gray-800 md:bg-transparent z-50 md:z-auto ${
      isSidebarOpen ? '' : 'md:w-0'
    } md:transition-all md:duration-300`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex justify-between items-center gap-2 mb-4">
          <span className="font-semibold">ReChat</span>
          <Button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1 h-8 w-8 bg-transparent hover:bg-gray-700 text-gray-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Button 
          onClick={() => onNewChat()}
          className="w-full bg-teal-600 hover:bg-teal-700 text-white shadow-[0_3px_10px_rgb(0,0,0,0.2)]"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Chat
        </Button>
      </div>

      {/* Search */}
      <div className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search your threads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-transparent border-b border-t-0 border-l-0 border-r-0 border-gray-400 rounded-none text-white placeholder-gray-400 focus-visible:ring-0 focus-visible:ring-transparent focus-visible:ring-offset-0 focus:!border-b-2"
          />
        </div>
      </div>

      {/* Conversations */}
      <ScrollArea className="flex-1 px-4 max-w-full">
        <div className="space-y-2 max-w-full">
          {isLoading ? (
            <div className="text-center text-gray-400 py-4">Loading chats...</div>
          ) : filteredChats.length === 0 ? (
            <div className="text-center text-gray-400 py-4">
              {searchQuery ? 'No chats found' : 'No chats yet. Create your first chat!'}
            </div>
          ) : (
            <>
              {/* Recent Chats */}
              {filteredChats.slice(0, 6).map((chat) => (
                <div
                  key={chat.id}
                  className={`group p-2 rounded-lg cursor-pointer transition-colors duration-300 relative w-full max-w-72 ${
                    selectedChat?.id === chat.id ? "bg-gray-600/20 border border-teal-600/30" : "border border-transparent hover:bg-gray-700/60"
                  }`}
                  onClick={() => onSelectChat(chat)}
                >
                  <div className="flex items-center gap-1 text-sm font-medium text-white truncate max-w-[70%]">
                    {chat.pinned && <Pin className="h-3 w-3 text-teal-400 flex-shrink-0" />}
                    <TypewriterText text={chat.title} speed={30} />
                  </div>
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      className="h-6 w-6 p-0 text-gray-400 hover:text-teal-400 hover:bg-teal-500/10"
                      onClick={(e) => {
                        e.stopPropagation()
                        onTogglePin(chat.id)
                      }}
                      title={chat.pinned ? "Unpin chat" : "Pin chat"}
                    >
                      <Pin className={`h-3 w-3 ${chat.pinned ? 'fill-current' : ''}`} />
                    </Button>
                    <Button
                      className="h-6 w-6 p-0 text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteChat(chat.id)
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}

              {/* Older Chats */}
              {filteredChats.length > 6 && (
                <div className="pt-4">
                  <div className="text-xs text-gray-500 mb-2 font-medium px-2">Older</div>
                  {filteredChats.slice(6).map((chat) => (
                    <div
                      key={chat.id}
                      className={`group p-3 rounded-lg cursor-pointer transition-colors duration-300 relative max-w-72 ${
                        selectedChat?.id === chat.id ? "bg-gray-600/20 border border-teal-600/30" : "border border-transparent hover:bg-gray-700/60"
                      }`}
                      onClick={() => onSelectChat(chat)}
                    >
                      <div className="flex items-center gap-1 text-sm text-gray-300 truncate max-w-[70%]">
                        {chat.pinned && <Pin className="h-3 w-3 text-teal-400 flex-shrink-0" />}
                        <TypewriterText text={chat.title} speed={30} />
                      </div>
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          className="h-6 w-6 p-0 text-gray-400 hover:text-teal-400 hover:bg-teal-500/10"
                          onClick={(e) => {
                            e.stopPropagation()
                            onTogglePin(chat.id)
                          }}
                          title={chat.pinned ? "Unpin chat" : "Pin chat"}
                        >
                          <Pin className={`h-3 w-3 ${chat.pinned ? 'fill-current' : ''}`} />
                        </Button>
                        <Button
                          className="h-6 w-6 p-0 text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDeleteChat(chat.id)
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {/* User Profile */}
      <div className="p-4 border-t border-gray-700">
        <SignedIn>
          <div 
            className="flex items-center gap-3 cursor-pointer hover:bg-gray-700 rounded-lg p-2 -m-2 transition-colors"
          >
            <UserButton />
            <div className="flex-grow flex items-center gap-3" onClick={() => { setIsSettingsOpen(true) }}>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white">{user?.fullName}</div>
              </div>
              <SettingsIcon className="w-4 h-4 text-gray-400" />
            </div>
          </div>
        </SignedIn>
        <SignedOut>
          <SignInButton>
            <div 
              className="flex items-center gap-3 cursor-pointer hover:bg-gray-700 rounded-lg p-2 -m-2 transition-colors"
            >
              Sign In
            </div>
          </SignInButton>
        </SignedOut>
      </div>
      
      <Settings 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </div>
  )
})

export { ChatSidebar }