import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { UsageTracker } from '@/lib/usage-db'

// Admin user IDs (you should replace these with actual admin user IDs)
const ADMIN_USER_IDS: string[] = [
]

// Check if user is admin
function isAdmin(userId: string): boolean {
  return ADMIN_USER_IDS.includes(userId)
}

// GET /api/admin/user-limits?userId=xxx - Get user limits
export async function GET(request: NextRequest) {
  try {
    const { userId: currentUserId } = await auth()
    
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    if (!isAdmin(currentUserId)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    const { searchParams } = new URL(request.url)
    const targetUserId = searchParams.get('userId')
    
    if (!targetUserId) {
      return NextResponse.json({ error: 'userId parameter required' }, { status: 400 })
    }
    
    const limits = await UsageTracker.getUserLimits(targetUserId)
    
    return NextResponse.json({
      userId: targetUserId,
      totalLimit: limits.totalLimit,
      premiumLimit: limits.premiumLimit
    })
    
  } catch (error) {
    console.error('Error getting user limits:', error)
    return NextResponse.json(
      { error: 'Failed to get user limits' },
      { status: 500 }
    )
  }
}

// POST /api/admin/user-limits - Set user limits
export async function POST(request: NextRequest) {
  try {
    const { userId: currentUserId } = await auth()
    
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    if (!isAdmin(currentUserId)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    const body = await request.json()
    const { userId, totalLimit, premiumLimit } = body
    
    if (!userId || typeof totalLimit !== 'number' || typeof premiumLimit !== 'number') {
      return NextResponse.json(
        { error: 'userId, totalLimit, and premiumLimit are required' },
        { status: 400 }
      )
    }
    
    if (totalLimit < 0 || premiumLimit < 0) {
      return NextResponse.json(
        { error: 'Limits must be non-negative numbers' },
        { status: 400 }
      )
    }
    
    await UsageTracker.setUserLimits(userId, totalLimit, premiumLimit)
    
    return NextResponse.json({
      success: true,
      message: `Limits updated for user ${userId}`,
      userId,
      totalLimit,
      premiumLimit
    })
    
  } catch (error) {
    console.error('Error setting user limits:', error)
    return NextResponse.json(
      { error: 'Failed to set user limits' },
      { status: 500 }
    )
  }
}