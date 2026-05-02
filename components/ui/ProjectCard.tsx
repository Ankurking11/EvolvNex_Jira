import Link from 'next/link'

interface ProjectCardProps {
  project: {
    id: string
    name: string
    description: string | null
    board: {
      tasks: { status: string }[]
    } | null
    createdAt: Date
  }
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const tasks = project.board?.tasks ?? []
  const taskCount = tasks.length
  const { todoCount, inProgressCount, doneCount } = tasks.reduce(
    (acc, t) => {
      if (t.status === 'TODO') acc.todoCount++
      else if (t.status === 'IN_PROGRESS') acc.inProgressCount++
      else if (t.status === 'DONE') acc.doneCount++
      return acc
    },
    { todoCount: 0, inProgressCount: 0, doneCount: 0 }
  )

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

        {taskCount > 0 && (
          <div className="mb-3">
            <div className="flex rounded-full overflow-hidden h-1.5 bg-gray-100">
              {todoCount > 0 && (
                <div
                  className="bg-gray-400 transition-all"
                  style={{ width: `${(todoCount / taskCount) * 100}%` }}
                />
              )}
              {inProgressCount > 0 && (
                <div
                  className="bg-blue-500 transition-all"
                  style={{ width: `${(inProgressCount / taskCount) * 100}%` }}
                />
              )}
              {doneCount > 0 && (
                <div
                  className="bg-green-500 transition-all"
                  style={{ width: `${(doneCount / taskCount) * 100}%` }}
                />
              )}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 text-xs text-gray-500">
          {todoCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
              {todoCount} To Do
            </span>
          )}
          {inProgressCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
              {inProgressCount} In Progress
            </span>
          )}
          {doneCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
              {doneCount} Done
            </span>
          )}
          {taskCount === 0 && (
            <span className="text-gray-400">No tasks yet</span>
          )}
        </div>
      </div>
    </Link>
  )
}
