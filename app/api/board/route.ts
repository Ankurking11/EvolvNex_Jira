import { NextRequest, NextResponse } from 'next/server'
import { getBoardData } from '@/lib/actions'

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('projectId')
  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  try {
    const board = await getBoardData(projectId)

    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 })
    }
    return NextResponse.json(board)
  } catch (error) {
    console.error('[GET /api/board] Failed to fetch board for project', projectId, error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
