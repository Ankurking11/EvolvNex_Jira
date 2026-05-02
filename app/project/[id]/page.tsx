import { getBoardData, getUsers } from '@/lib/actions'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import BoardClient from '@/components/board/BoardClient'
import Link from 'next/link'

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
  })

  if (!project) notFound()

  const board = await getBoardData(params.id)
  const users = await getUsers()

  if (!board) notFound()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex-shrink-0">
        <div className="max-w-full mx-auto flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline text-sm">Projects</span>
          </Link>
          <div className="w-px h-5 bg-gray-200" />
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-xs">{project.name[0]}</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-gray-900 truncate">{project.name}</h1>
              {project.description && (
                <p className="text-xs text-gray-500 truncate hidden sm:block">{project.description}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <BoardClient board={board} users={users} projectId={params.id} />
      </div>
    </div>
  )
}
