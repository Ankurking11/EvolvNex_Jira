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
    notFound()
  }

  if (!project) notFound()

  const board = await getBoardData(id)
  const users = await getUsers()

  if (!board) notFound()

  const boardStateKey = [
    board.id,
    project.id,
    project.name,
    project.description ?? '',
    project.updatedAt.toISOString(),
    board.members.map((member) => member.id).join(','),
    board.tasks.map((task) => `${task.id}:${task.status}:${new Date(task.updatedAt).toISOString()}`).join(','),
  ].join('|')

  return (
    <div className="h-full overflow-hidden">
      <BoardClient
        key={boardStateKey}
        board={board}
        users={users}
        projectId={id}
        projectName={project.name}
        projectDescription={project.description}
      />
    </div>
  )
}
