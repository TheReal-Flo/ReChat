import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function POST(request: NextRequest) {
  try {
    // Check authentication - allow both user auth and server-to-server calls
    const { userId } = await auth()
    const authHeader = request.headers.get('Authorization')
    const isServerCall = authHeader?.startsWith('Bearer ') && authHeader.includes(process.env.CLERK_SECRET_KEY || '')
    
    if (!userId && !isServerCall) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { query, num = 5 } = await request.json()
    
    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.SERPER_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Serper API key not configured' },
        { status: 500 }
      )
    }

    const myHeaders = new Headers()
    myHeaders.append('X-API-KEY', apiKey)
    myHeaders.append('Content-Type', 'application/json')

    const raw = JSON.stringify({
      q: query,
      num: Math.min(num, 10) // Limit to max 10 results
    })

    const requestOptions = {
      method: 'POST',
      headers: myHeaders,
      body: raw,
    }

    const response = await fetch('https://google.serper.dev/search', requestOptions)
    
    if (!response.ok) {
      throw new Error(`Serper API error: ${response.status}`)
    }

    const result = await response.json()

    console.log('Serper API response:', result)
    
    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('Web search error:', error)
    return NextResponse.json(
      { error: 'Failed to perform web search' },
      { status: 500 }
    )
  }
}