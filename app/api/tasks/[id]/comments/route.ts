import { NextResponse } from 'next/server'
import { getTaskComments } from '@/lib/actions'

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  try {
    const comments = await getTaskComments(id)
    return NextResponse.json(comments)
  } catch (error) {
    console.error('[GET /api/tasks/[id]/comments] Failed to fetch comments', { id }, error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
