export const dynamic = 'force-dynamic'

import { getBoardData, getUsers } from '@/lib/actions'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import BoardClient from '@/components/board/BoardClient'

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let project = null
  try {
    project = await prisma.project.findUnique({
      where: { id },
    })
  } catch (error) {
    console.error('[ProjectPage] Failed to fetch project', { id }, error)
    throw error
  }

  if (!project) {
    notFound()
  }

  let board = await getBoardData(id)
  const users = await getUsers()

  if (!board) {
    const boardExists = await prisma.board.findFirst({
      where: { projectId: id },
      select: { id: true },
    })

    if (!boardExists) {
      notFound()
    }

    console.warn('[ProjectPage] Board data unavailable, rendering fallback shell', { projectId: id })
    board = { id: boardExists.id, tasks: [], members: [] }
  }

  return (
    <div className="h-full overflow-hidden">
      <BoardClient
        board={board}
        users={users}
        projectId={id}
        projectName={project.name}
        projectDescription={project.description}
      />
    </div>
  )
}
