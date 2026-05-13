export const dynamic = 'force-dynamic'

import { getBoardData, getUsers } from '@/lib/actions'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import BoardClient from '@/components/board/BoardClient'

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  console.log('[DEBUG] ProjectPage called with id:', id)

  let project = null
  try {
    project = await prisma.project.findUnique({
      where: { id },
    })
    console.log('[DEBUG] Project found:', project ? 'yes' : 'no', project?.name)
  } catch (error) {
    console.error('[ProjectPage] Failed to fetch project', { id }, error)
    notFound()
  }

  if (!project) {
    console.log('[DEBUG] Project not found, calling notFound()')
    notFound()
  }

  const board = await getBoardData(id)
  const users = await getUsers()

  if (!board) notFound()

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
