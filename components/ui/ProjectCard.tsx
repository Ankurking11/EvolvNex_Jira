import Link from 'next/link'

interface ProjectCardProps {
  project: {
    id: string
    name: string
    description: string | null
    board: {
      _count: {
        tasks: number
      }
    } | null
    createdAt: Date
  }
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const taskCount = project.board?._count?.tasks ?? 0
  
  return (
    <Link href={`/project/${project.id}`}>
      <div className="bg-white rounded-lg border border-gray-200 p-5 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
            <span className="text-blue-700 font-bold text-sm">{project.name[0]}</span>
          </div>
          <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
        <h3 className="font-semibold text-gray-900 mb-1">{project.name}</h3>
        {project.description && (
          <p className="text-sm text-gray-500 mb-3 line-clamp-2">{project.description}</p>
        )}
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span>{taskCount} {taskCount === 1 ? 'task' : 'tasks'}</span>
        </div>
      </div>
    </Link>
  )
}
