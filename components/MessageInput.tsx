import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuSubContent,
  DropdownMenuSub,
  DropdownMenuPortal,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { ArrowUp, ChevronDown, X, File, Image, Palette } from "lucide-react"
import type { Chat } from "../types/chat"
import { useState, useEffect } from "react"
import { FileUploadDialog } from "./FileUploadDialog"

interface MessageInputProps {
  message: string
  setMessage: (message: string) => void
  selectedChat: Chat | null
  selectedModel: string
  setSelectedModel: (model: string) => void
  isStreaming: boolean
  onSendMessage: () => void
  onGenerateImage: () => void
  onKeyPress: (e: React.KeyboardEvent) => void
  attachments: { name: string; type: string; url: string }[]
  onAttachmentsChange: (attachments: { name: string; type: string; url: string }[]) => void
  user: any // Add user prop for authentication check
}

interface AIModel {
  name: string
  value: string
  provider: string
}

const aiModels: AIModel[] = [
  { name: "DeepSeek R1", value: "deepseek-r1", provider: "DeepSeek" },
  { name: "Qwen3 30B", value: "qwen3-30b", provider: "Qwen" },
  { name: "Llama 3.3", value: "llama-3.3", provider: "Meta" },
  { name: "o4 Mini High", value: "o4-mini-high", provider: "OpenAI" },
  { name: "o4 Mini", value: "o4-mini", provider: "OpenAI" },
  { name: "GPT-4.1", value: "gpt-4.1", provider: "OpenAI" },
  { name: "GPT-4.1 Mini", value: "gpt-4.1-mini", provider: "OpenAI" },
  { name: "Claude 3.5 Sonnet", value: "claude-3.5-sonnet", provider: "Anthropic" },
  { name: "Claude 3 Haiku", value: "claude-3-haiku", provider: "Anthropic" },
  { name: "Claude 3 Opus", value: "claude-3-opus", provider: "Anthropic" },
  { name: "Claude 3.7 Sonnet", value: "claude-3.7-sonnet", provider: "Anthropic" },
  { name: "Claude Sonnet 4", value: "claude-sonnet-4", provider: "Anthropic" },
  { name: "Claude Opus 4", value: "claude-opus-4", provider: "Anthropic" },
  { name: "Gemini 2.5 Pro", value: "gemini-2.5-pro", provider: "Google" },
  { name: "Gemini 2.0 Flash Lite", value: "gemini-2.0-flash-lite", provider: "Google" },
  { name: "Gemini 2.0 Flash", value: "gemini-2.0-flash", provider: "Google" },
  { name: "Gemini 2.0", value: "deepseek-r1-free", provider: "Free" },
  { name: "Llama 3.3 8B", value: "llama-3.3-free", provider: "Free" },
]

export function MessageInput({
  message,
  setMessage,
  selectedChat,
  selectedModel,
  setSelectedModel,
  isStreaming,
  onSendMessage,
  onGenerateImage,
  onKeyPress,
  attachments,
  onAttachmentsChange,
  user
}: MessageInputProps) {
  const [recentModels, setRecentModels] = useState<string[]>([])

  // Load recent models from localStorage on component mount
  useEffect(() => {
    const saved = localStorage.getItem('recentModels')
    if (saved) {
      setRecentModels(JSON.parse(saved))
    }
  }, [])

  // Update recent models when a model is selected
  const handleModelSelect = (modelValue: string) => {
    setSelectedModel(modelValue)
    
    // Update recent models list
    const updatedRecent = [modelValue, ...recentModels.filter(m => m !== modelValue)].slice(0, 3)
    setRecentModels(updatedRecent)
    localStorage.setItem('recentModels', JSON.stringify(updatedRecent))
  }

  const getSelectedModelName = () => {
    return aiModels.find(model => model.value === selectedModel)?.name || "Select Model"
  }

  // Group models by provider
  const groupedModels = aiModels.reduce((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = []
    }
    acc[model.provider].push(model)
    return acc
  }, {} as Record<string, AIModel[]>)

  // Get recent model objects
  const recentModelObjects = recentModels
    .map(value => aiModels.find(model => model.value === value))
    .filter(Boolean) as AIModel[]

  const handleFilesSelected = (files: { name: string; type: string; url: string }[]) => {
    onAttachmentsChange([...attachments, ...files])
  }

  const removeAttachment = (index: number) => {
    onAttachmentsChange(attachments.filter((_, i) => i !== index))
  }

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="w-3 h-3" />
    return <File className="w-3 h-3" />
  }

  return (
    <div className="absolute bottom-0 left-0 right-0 flex justify-center w-full bg-gradient-to-t from-gray-900 via-gray-900 to-transparent pt-10 pb-6 px-4 md:px-0">
      <div className="max-w-full md:max-w-[50%] w-full md:w-[50%] rounded-xl p-1 bg-[conic-gradient(at_left,_var(--tw-gradient-stops))] from-teal-400 to-cyan-400 shadow-[5px_5px_30px_10px_#ffffff20]">
        <div className="bg-gray-800 rounded-lg !shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)]">
          <div className="mx-auto space-y-3 p-3">
            <div className="relative">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={onKeyPress}
                placeholder={!user ? "Please sign in to use AI chat..." : "Type your message here..."}
                className="bg-transparent border-none !text-lg text-white placeholder-gray-200 min-h-[50px] focus-visible:ring-0 focus-visible:ring-transparent focus-visible:ring-offset-0"
                disabled={!selectedChat || !user}
              />
            </div>

            {/* Attachments Preview */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 px-1">
                {attachments.map((attachment, index) => (
                  <div key={index}>
                    {attachment.type.startsWith('image/') && attachment.url ? (
                      <div className="relative bg-gray-700/50 rounded-lg p-2">
                        <div className="flex items-center gap-1 mb-2 text-xs">
                          {getFileIcon(attachment.type)}
                          <span className="text-gray-300 max-w-[100px] truncate">{attachment.name}</span>
                          <button
                            onClick={() => removeAttachment(index)}
                            className="text-gray-400 hover:text-red-400 ml-1"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <img 
                          src={attachment.url} 
                          alt={attachment.name}
                          className="max-w-24 max-h-24 rounded object-cover"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 bg-gray-700/50 rounded-lg px-2 py-1 text-xs">
                        {getFileIcon(attachment.type)}
                        <span className="text-gray-300 max-w-[100px] truncate">{attachment.name}</span>
                        <button
                          onClick={() => removeAttachment(index)}
                          className="text-gray-400 hover:text-red-400 ml-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4 text-gray-400">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <div className="flex items-center gap-1 border border-gray-600 rounded-lg px-3 py-1 cursor-pointer hover:bg-gray-700/50 transition-colors">
                      <span>{getSelectedModelName()}</span>
                      <ChevronDown className="w-3 h-3" />
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-gray-800 border-gray-600 w-64">
                    {/* Recent Models Section */}
                    {recentModelObjects.length > 0 && (
                      <>
                        <DropdownMenuLabel className="text-gray-400 text-xs font-medium px-2 py-1.5">
                          Recent
                        </DropdownMenuLabel>
                        {recentModelObjects.map(model => (
                          <DropdownMenuItem 
                            key={`recent-${model.value}`} 
                            onClick={() => handleModelSelect(model.value)}
                            className="text-gray-300 hover:bg-gray-700 focus:bg-gray-700 cursor-pointer"
                          >
                            <div className="flex items-center justify-between w-full">
                              <span>{model.name}</span>
                              <span className="text-xs text-gray-500">{model.provider}</span>
                            </div>
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator className="bg-gray-600" />
                      </>
                    )}
                    
                    {/* Models grouped by provider */}
                    {Object.entries(groupedModels)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([provider, models]) => (
                        <DropdownMenuSub key={provider}>
                          <DropdownMenuSubTrigger>
                            {provider}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuPortal>
                            <DropdownMenuSubContent>
                              {models.map(model => (
                                <DropdownMenuItem 
                                  key={model.value} 
                                  onClick={() => handleModelSelect(model.value)}
                                  className="text-gray-300 hover:bg-gray-700 focus:bg-gray-700 cursor-pointer pl-4"
                                >
                                  {model.name}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuSubContent>
                          </DropdownMenuPortal>
                        </DropdownMenuSub>
                      ))
                    }
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <FileUploadDialog 
                  onFilesSelected={handleFilesSelected}
                  disabled={!selectedChat || !user}
                />
                
                <Button
                  onClick={onGenerateImage}
                  disabled={!message.trim() || !selectedChat || isStreaming || !user}
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors duration-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  title={!user ? "Please sign in to generate images" : "Generate Image"}
                >
                  <Palette className="w-4 h-4" />
                </Button>
              </div>
              <Button 
                onClick={onSendMessage}
                disabled={!message.trim() || !selectedChat || isStreaming || !user}
                className="bg-teal-600 hover:bg-teal-700 transition-colors duration-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                title={!user ? "Please sign in to send messages" : "Send message"}
              >
                {isStreaming ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <ArrowUp className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}