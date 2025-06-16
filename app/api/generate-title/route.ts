import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message }: { message: string } = body

    // Validate input
    if (!message) {
      return NextResponse.json(
        { error: 'Missing required fields: message' },
        { status: 400 }
      )
    }

    // Make request to OpenRouter API with reasoning configuration
    const response = await fetch(`https://openrouter.ai/api/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.3-70b-instruct",
        messages: [
          {
            role: "system",
            content: `You are a title generation assistant. Your task is to create concise, descriptive titles for chat conversations. Follow these rules:

## Title Guidelines
- Generate titles that are **5-7 words maximum**
- Make titles **descriptive and specific** to the topic
- Use **clear, professional language**
- Avoid generic titles like "Chat" or "Conversation"
- Focus on the **main subject or task** being discussed
- Use **title case** formatting
- Do not include quotation marks or special formatting

## Examples
- "React Component State Management Help"
- "Python Data Analysis Tutorial"
- "Database Schema Design Discussion"
- "API Integration Troubleshooting"

Generate only the title text, nothing else.`
          },
          {
            role: "user",
            content: message
          }
        ],
        stream: true
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Response body is not readable')
    }

    const decoder = new TextDecoder()
    const encoder = new TextEncoder()
    
    const stream = new ReadableStream({
      async start(controller) {
        let buffer = ''
        
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            // Append new chunk to buffer
            buffer += decoder.decode(value, { stream: true })

            // Process complete lines from buffer
            while (true) {
              const lineEnd = buffer.indexOf('\n')
              if (lineEnd === -1) break

              const line = buffer.slice(0, lineEnd).trim()
              buffer = buffer.slice(lineEnd + 1)

              if (line.startsWith('data: ')) {
                const data = line.slice(6)
                if (data === '[DONE]') break

                try {
                  const parsed = JSON.parse(data)
                  const content = parsed.choices[0]?.delta?.content
                  if (content) {
                    controller.enqueue(encoder.encode(content))
                  }
                } catch (e) {
                  // Ignore invalid JSON
                }
              }
            }
          }
        } catch (error) {
          console.error('Title generation streaming error:', error)
          controller.error(error)
        } finally {
          reader.cancel()
          controller.close()
        }
      }
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })
  } catch (error) {
    console.error('API route error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}