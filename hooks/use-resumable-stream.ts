import { useState, useEffect, useCallback, useRef } from 'react'
import { Message } from '@/types/chat'

export interface StreamState {
  streamId: string | null
  isStreaming: boolean
  content: string
  status: 'idle' | 'starting' | 'streaming' | 'completed' | 'error' | 'cancelled'
  error: string | null
}

export interface UseResumableStreamOptions {
  onContentUpdate?: (content: string) => void
  onComplete?: (content: string) => void
  onError?: (error: string) => void
  autoReconnect?: boolean
  reconnectInterval?: number
  maxReconnectAttempts?: number
}

export function useResumableStream(options: UseResumableStreamOptions = {}) {
  const {
    onContentUpdate,
    onComplete,
    onError,
    autoReconnect = true,
    reconnectInterval = 2000,
    maxReconnectAttempts = 5
  } = options

  const [streamState, setStreamState] = useState<StreamState>({
    streamId: null,
    isStreaming: false,
    content: '',
    status: 'idle',
    error: null
  })

  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Start a new resumable stream
  const startStream = useCallback(async (
    chatId: string,
    messageId: string,
    modelId: string,
    messages: Message[],
    apiKey?: string
  ): Promise<string | null> => {
    try {
      setStreamState(prev => ({
        ...prev,
        status: 'starting',
        error: null
      }))

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }

      if (apiKey) {
        headers['x-openrouter-api-key'] = apiKey
      }

      // Get memory setting from localStorage
      const memoryEnabled = localStorage.getItem('memory_enabled') !== 'false'
      
      const response = await fetch('/api/stream/start', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          chatId,
          messageId,
          modelId,
          messages,
          memoryEnabled
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to start stream')
      }

      const { streamId } = await response.json()
      
      setStreamState(prev => ({
        ...prev,
        streamId,
        status: 'streaming',
        isStreaming: true
      }))

      // Start consuming the stream
      await resumeStream(streamId)
      
      return streamId
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setStreamState(prev => ({
        ...prev,
        status: 'error',
        error: errorMessage,
        isStreaming: false
      }))
      onError?.(errorMessage)
      return null
    }
  }, [onError])

  // Resume an existing stream
  const resumeStream = useCallback(async (streamId: string) => {
    try {
      // Cancel any existing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      abortControllerRef.current = new AbortController()
      
      setStreamState(prev => ({
        ...prev,
        streamId,
        content: '', // Clear content when resuming
        status: 'streaming',
        isStreaming: true,
        error: null
      }))

      const response = await fetch(`/api/stream/resume/${streamId}`, {
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Stream not found or expired')
        } else if (response.status === 403) {
          throw new Error('Unauthorized access to stream')
        } else if (response.status === 410) {
          throw new Error('Stream was cancelled')
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No reader available')
      }

      readerRef.current = reader
      let accumulatedContent = ''
      reconnectAttemptsRef.current = 0

      while (true) {
        try {
          const { done, value } = await reader.read()
          if (done) {
            setStreamState(prev => ({
              ...prev,
              status: 'completed',
              isStreaming: false
            }))
            onComplete?.(accumulatedContent)
            break
          }

          const chunk = new TextDecoder().decode(value)
          accumulatedContent += chunk
          
          setStreamState(prev => ({
            ...prev,
            content: accumulatedContent
          }))
          
          onContentUpdate?.(accumulatedContent)
        } catch (readError) {
          if (readError instanceof Error && readError.name === 'AbortError') {
            // Stream was intentionally cancelled
            break
          }
          throw readError
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Stream was intentionally cancelled
        return
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Stream error:', error)
      
      // Try to reconnect if enabled and we haven't exceeded max attempts
      if (autoReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++
        console.log(`Attempting to reconnect (${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`)
        
        reconnectTimeoutRef.current = setTimeout(() => {
          resumeStream(streamId)
        }, reconnectInterval)
      } else {
        setStreamState(prev => ({
          ...prev,
          status: 'error',
          error: errorMessage,
          isStreaming: false
        }))
        onError?.(errorMessage)
      }
    }
  }, [onContentUpdate, onComplete, onError, autoReconnect, reconnectInterval, maxReconnectAttempts])

  // Cancel the current stream
  const cancelStream = useCallback(async () => {
    if (!streamState.streamId) return

    try {
      // Cancel the fetch request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      // Cancel the stream on the server
      await fetch(`/api/stream/cancel/${streamState.streamId}`, {
        method: 'DELETE'
      })

      setStreamState(prev => ({
        ...prev,
        status: 'cancelled',
        isStreaming: false
      }))
    } catch (error) {
      console.error('Error cancelling stream:', error)
    }
  }, [streamState.streamId])

  // Get stream status
  const getStreamStatus = useCallback(async (streamId: string) => {
    try {
      const response = await fetch(`/api/stream/status/${streamId}`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      return await response.json()
    } catch (error) {
      console.error('Error getting stream status:', error)
      return null
    }
  }, [])

  // Check for resumable streams on mount
  useEffect(() => {
    const checkForResumableStreams = async () => {
      // Check localStorage for any stored stream IDs
      const storedStreamId = localStorage.getItem('currentStreamId')
      if (storedStreamId) {
        const status = await getStreamStatus(storedStreamId)
        if (status?.exists && status.status === 'streaming') {
          // Resume the stream
          console.log('Resuming stream:', storedStreamId)
          await resumeStream(storedStreamId)
        } else {
          // Clean up expired stream ID
          localStorage.removeItem('currentStreamId')
        }
      }
    }

    checkForResumableStreams()
  }, [getStreamStatus, resumeStream])

  // Store current stream ID in localStorage
  useEffect(() => {
    if (streamState.streamId && streamState.status === 'streaming') {
      localStorage.setItem('currentStreamId', streamState.streamId)
    } else {
      localStorage.removeItem('currentStreamId')
    }
  }, [streamState.streamId, streamState.status])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (readerRef.current) {
        readerRef.current.cancel()
      }
    }
  }, [])

  return {
    streamState,
    startStream,
    resumeStream,
    cancelStream,
    getStreamStatus
  }
}