export const dynamic = 'force-dynamic'

import { getProjects } from '@/lib/actions'
import ProjectCard from '@/components/ui/ProjectCard'
import CreateProjectButton from '@/components/ui/CreateProjectButton'

export default async function DashboardPage() {
  const projects = await getProjects()

  const allTasks = projects.flatMap((p) => p.board?.tasks ?? [])
  const totalTasks = allTasks.length
  const { todoCount, inProgressCount, doneCount } = allTasks.reduce(
    (acc, t) => {
      if (t.status === 'TODO') acc.todoCount++
      else if (t.status === 'IN_PROGRESS') acc.inProgressCount++
      else if (t.status === 'DONE') acc.doneCount++
      return acc
    },
    { todoCount: 0, inProgressCount: 0, doneCount: 0 }
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">E</span>
            </div>
            <h1 className="text-xl font-semibold text-gray-900">EvolvNex</h1>
          </div>
          <CreateProjectButton />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-gray-500 mt-1">Overview of your projects and tasks</p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Projects</p>
            <p className="text-3xl font-bold text-gray-900">{projects.length}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">To Do</p>
            <p className="text-3xl font-bold text-gray-500">{todoCount}</p>
            <p className="text-xs text-gray-400 mt-1">{totalTasks > 0 ? Math.round((todoCount / totalTasks) * 100) : 0}% of tasks</p>
          </div>
          <div className="bg-white rounded-lg border border-blue-100 p-4">
            <p className="text-xs font-medium text-blue-500 uppercase tracking-wide mb-1">In Progress</p>
            <p className="text-3xl font-bold text-blue-600">{inProgressCount}</p>
            <p className="text-xs text-gray-400 mt-1">{totalTasks > 0 ? Math.round((inProgressCount / totalTasks) * 100) : 0}% of tasks</p>
          </div>
          <div className="bg-white rounded-lg border border-green-100 p-4">
            <p className="text-xs font-medium text-green-600 uppercase tracking-wide mb-1">Done</p>
            <p className="text-3xl font-bold text-green-600">{doneCount}</p>
            <p className="text-xs text-gray-400 mt-1">{totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0}% of tasks</p>
          </div>
        </div>

        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Projects</h3>
          <p className="text-sm text-gray-500">{projects.length} {projects.length === 1 ? 'project' : 'projects'}</p>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
            <p className="text-gray-500">Create your first project to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
