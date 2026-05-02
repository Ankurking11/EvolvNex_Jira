import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('projectId')
  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  const board = await prisma.board.findFirst({
    where: { projectId },
    include: {
      tasks: {
        include: { assignee: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!board) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 })
  }

  return NextResponse.json(board)
}
