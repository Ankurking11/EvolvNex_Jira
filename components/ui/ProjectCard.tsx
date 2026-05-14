import Link from 'next/link'

interface ProjectCardProps {
  project: {
    id: string
    name: string
    description: string | null
    board: {
      tasks: { status: string }[]
    } | null
    createdAt: Date | string
  }
  selectionMode?: boolean
  isSelected?: boolean
  onSelect?: (projectId: string) => void
  disabled?: boolean
}

export default function ProjectCard({
  project,
  selectionMode = false,
  isSelected = false,
  onSelect,
  disabled = false,
}: ProjectCardProps) {
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

  const card = (
    <div
      className={`bg-white rounded-lg border p-5 transition-all cursor-pointer group ${
        isSelected ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
      } ${disabled ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
          <span className="text-blue-700 font-bold text-sm">{project.name[0]}</span>
        </div>
        {selectionMode ? (
          <span
            className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold ${
              isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white text-transparent'
            }`}
          >
            ✓
          </span>
        ) : (
          <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
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
  )

  if (selectionMode) {
    return (
      <button
        type="button"
        onClick={() => onSelect?.(project.id)}
        disabled={disabled}
        aria-pressed={isSelected}
        aria-label={`${isSelected ? 'Deselect' : 'Select'} project ${project.name}`}
        className="w-full text-left disabled:cursor-not-allowed"
      >
        {card}
      </button>
    )
  }

  return (
    <Link href={`/project/${project.id}`}>
      {card}
    </Link>
  )
}
