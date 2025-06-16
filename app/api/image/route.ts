import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { UsageTracker } from '@/lib/usage-db'
import OpenAI from 'openai'

export async function POST(request: NextRequest) {
  const { userId } = await auth()

  try {
    const body = await request.json()
    const { prompt, model = 'gpt-image-1', size = 'any', quality = 'low' } = body
    
    // Get API key from request headers or environment
    const customApiKey = request.headers.get('x-openai-api-key')
    const apiKey = customApiKey || process.env.OPENAI_API_KEY
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is required. Please set your API key in settings.' },
        { status: 401 }
      )
    }

    // Validate input
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: prompt' },
        { status: 400 }
      )
    }

    // Check if user is authenticated (image generation requires authentication)
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required for image generation' },
        { status: 403 }
      )
    }

    // Check usage limits for authenticated users (skip if using custom API key)
    // Image generation is considered premium usage
    if (userId && !customApiKey) {
      const usageCheck = await UsageTracker.checkUsageLimit(userId, model)
      if (!usageCheck.canSend) {
        return NextResponse.json(
          { error: usageCheck.reason },
          { status: 429 }
        )
      }
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: apiKey
    })

    try {
      // Generate image using OpenAI SDK
      const result = await openai.images.generate({
        model: "gpt-image-1",
        prompt: prompt,
        size: "auto",
        quality: "low"
      })

      if (!result?.data?.[0]?.b64_json) {
        throw new Error('Failed to generate image: No image data received');
      }
      const image_base64 = result.data[0].b64_json;

      // Record usage for authenticated users (skip if using custom API key)
      if (userId && !customApiKey) {
        try {
          await UsageTracker.recordUsage(userId, model, !!customApiKey)
          console.log(`Recorded image generation usage for user ${userId} with model ${model}`)
        } catch (error) {
          console.error('Failed to record usage:', error)
          // Don't fail the request if usage recording fails
        }
      }

      // Return the generated image
      return new Response(image_base64, {
        headers: {
          'Content-Type': 'text/plain',
        },
      })

    } catch (error: any) {
      console.error('OpenAI API error:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to generate image' },
        { status: error.status || 500 }
      )
    }

  } catch (error) {
    console.error('Image generation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}