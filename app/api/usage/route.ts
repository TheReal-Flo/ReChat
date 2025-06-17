import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { UsageTracker } from '@/lib/usage-db'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const usage = await UsageTracker.getUserUsage(userId)
    const limits = await UsageTracker.getUserLimits(userId)
    
    return NextResponse.json({
      ...usage,
      totalLimit: limits.totalLimit,
      premiumLimit: limits.premiumLimit
    })
  } catch (error) {
    console.error('Usage API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    return NextResponse.json({ success: false })
  } catch (error) {
    console.error('Usage reset API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}