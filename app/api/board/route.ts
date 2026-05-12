import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('projectId')
  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  try {
    const board = await prisma.board.findFirst({
      where: { projectId },
      include: {
        project: {
          include: {
            members: {
              include: {
                user: true,
              },
              orderBy: {
                user: {
                  name: 'asc',
                },
              },
            },
          },
        },
        tasks: {
          include: {
            assignee: true,
            _count: {
              select: {
                comments: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: board.id,
      members: board.project.members.map((member) => member.user),
      tasks: board.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        assigneeId: task.assigneeId,
        assignee: task.assignee,
        commentCount: task._count.comments,
        boardId: task.boardId,
        dueDate: task.dueDate,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      })),
    })
  } catch (error) {
    console.error('[GET /api/board] Failed to fetch board for project', projectId, error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
