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
    <div className="h-full overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
      <section className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3 sm:p-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 sm:text-xl">Dashboard</h1>
          <p className="mt-0.5 text-sm text-gray-600">Operational overview for projects, tasks, and progress.</p>
        </div>
        <CreateProjectButton />
      </section>

      <section className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Projects</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{projects.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">To Do</p>
          <p className="mt-1 text-2xl font-bold text-gray-700">{todoCount}</p>
          <p className="text-[11px] text-gray-500">{totalTasks > 0 ? Math.round((todoCount / totalTasks) * 100) : 0}%</p>
        </div>
        <div className="rounded-lg border border-blue-200 bg-white p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">In Progress</p>
          <p className="mt-1 text-2xl font-bold text-blue-700">{inProgressCount}</p>
          <p className="text-[11px] text-gray-500">{totalTasks > 0 ? Math.round((inProgressCount / totalTasks) * 100) : 0}%</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-white p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">Done</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{doneCount}</p>
          <p className="text-[11px] text-gray-500">{totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0}%</p>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Projects</h2>
          <p className="text-xs text-gray-500">
            {projects.length} {projects.length === 1 ? 'project' : 'projects'}
          </p>
        </div>

        {projects.length === 0 ? (
          <div className="grid min-h-64 place-items-center rounded-md border border-dashed border-gray-300 bg-gray-50 text-center">
            <div>
              <h3 className="text-base font-semibold text-gray-800">No projects yet</h3>
              <p className="mt-1 text-sm text-gray-500">Create your first project to start planning work.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
