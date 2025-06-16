import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { StreamManager } from '@/lib/stream-manager'
import { Message } from '@/types/chat'
import { UsageTracker } from '@/lib/usage-db'

// Model mapping to OpenRouter endpoints
const MODEL_MAPPING = {
  "deepseek-r1": "deepseek/deepseek-r1-0528",
  "qwen3-30b": "qwen/qwen3-30b-a3b:free",
  "llama-3.3": "meta-llama/llama-3.3-8b-instruct:free",
  "o4-mini-high": "openai/o4-mini-high",
  "o4-mini": "openai/o4-mini",
  "gpt-4.1": "openai/gpt-4.1",
  "gpt-4.1-mini": "openai/gpt-4.1-mini",
  "claude-3.5-sonnet": "anthropic/claude-3.5-sonnet",
  "claude-3-haiku": "anthropic/claude-3-haiku",
  "claude-3-opus": "anthropic/claude-3-opus",
  "claude-3.7-sonnet": "anthropic/claude-3.7-sonnet",
  "claude-sonnet-4": "anthropic/claude-sonnet-4",
  "claude-opus-4": "anthropic/claude-opus-4",
  "gemini-2.5-pro": "google/gemini-2.5-pro-preview",
  "gemini-2.0-flash-lite": "google/gemini-2.0-flash-lite-001",
  "gemini-2.0-flash": "google/gemini-2.0-flash-001",
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    const body = await request.json()
    const { 
      chatId, 
      messageId, 
      modelId, 
      messages 
    }: { 
      chatId: string
      messageId: string
      modelId: string
      messages: Message[] 
    } = body

    // Validate input
    if (!chatId || !messageId || !modelId || !messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Missing required fields: chatId, messageId, modelId, and messages' },
        { status: 400 }
      )
    }

    // Check if user is authenticated and restrict model for unauthenticated users
    if (!userId && modelId !== 'gemini-2.0-flash') {
      return NextResponse.json(
        { error: 'Unauthenticated users can only use gemini-2.0-flash model' },
        { status: 403 }
      )
    }

    // Get API key from request headers or environment
    const customApiKey = request.headers.get('x-openrouter-api-key')
    const apiKey = customApiKey || process.env.OPENROUTER_API_KEY
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenRouter API key is required. Please set your API key in settings.' },
        { status: 401 }
      )
    }

    // Check usage limits for authenticated users (skip if using custom API key)
    if (userId && !customApiKey) {
      const usageCheck = await UsageTracker.checkUsageLimit(userId, modelId)
      if (!usageCheck.canSend) {
        return NextResponse.json(
          { error: usageCheck.reason },
          { status: 429 }
        )
      }
    }
    
    // Get the actual model endpoint from mapping
    const actualModel = MODEL_MAPPING[modelId as keyof typeof MODEL_MAPPING]
    if (!actualModel) {
      return NextResponse.json(
        { error: `Unsupported model: ${modelId}` },
        { status: 400 }
      )
    }

    // Create resumable stream
    const streamId = await StreamManager.startStream(
      chatId,
      messageId,
      userId || 'anonymous',
      modelId,
      messages,
      customApiKey || undefined
    )

    return NextResponse.json({
      streamId,
      status: 'started'
    })

  } catch (error) {
    console.error('Stream start error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}