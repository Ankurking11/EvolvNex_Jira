export const dynamic = 'force-dynamic'

import { getProjects, getUsers } from '@/lib/actions'
import ProjectCard from '@/components/ui/ProjectCard'
import CreateProjectButton from '@/components/ui/CreateProjectButton'

type DashboardView = 'dashboard' | 'projects' | 'my-tasks' | 'activity' | 'reports' | 'settings'

function getViewLabel(view: DashboardView) {
  if (view === 'projects') return 'Projects'
  if (view === 'my-tasks') return 'My Tasks'
  if (view === 'activity') return 'Activity'
  if (view === 'reports') return 'Reports'
  if (view === 'settings') return 'Settings'
  return 'Dashboard'
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const requestedView = resolvedSearchParams.view
  const view: DashboardView =
    requestedView === 'projects' ||
    requestedView === 'my-tasks' ||
    requestedView === 'activity' ||
    requestedView === 'reports' ||
    requestedView === 'settings'
      ? requestedView
      : 'dashboard'

  const [projects, users] = await Promise.all([getProjects(), getUsers()])
  const allTasks = projects.flatMap((project) =>
    (project.board?.tasks ?? []).map((task) => ({
      ...task,
      projectId: project.id,
      projectName: project.name,
      projectDescription: project.description,
      memberCount: project.members.length,
    }))
  )

  const totalTasks = allTasks.length
  const { todoCount, inProgressCount, doneCount } = allTasks.reduce(
    (acc, task) => {
      if (task.status === 'TODO') acc.todoCount++
      else if (task.status === 'IN_PROGRESS') acc.inProgressCount++
      else if (task.status === 'DONE') acc.doneCount++
      return acc
    },
    { todoCount: 0, inProgressCount: 0, doneCount: 0 }
  )

  const unassignedCount = allTasks.filter((task) => !task.assigneeId).length
  const recentTasks = [...allTasks].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()).slice(0, 10)
  const tasksByAssignee = users.map((user) => ({
    user,
    tasks: allTasks.filter((task) => task.assigneeId === user.id).sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()),
  }))
  const unassignedTasks = allTasks.filter((task) => !task.assigneeId)

  const summarySection = (
    <>
      <section className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3 sm:p-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 sm:text-xl">{getViewLabel(view)}</h1>
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
    </>
  )

  return (
    <div className="h-full overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
      {(view === 'dashboard' || view === 'projects') && (
        <>
          {summarySection}
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
        </>
      )}

      {view === 'my-tasks' && (
        <>
          {summarySection}
          <section className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">Tasks by owner</h2>
                <p className="text-xs text-gray-500">{allTasks.length} tracked tasks</p>
              </div>

              <div className="space-y-4">
                {tasksByAssignee.map(({ user, tasks }) => (
                  <div key={user.id} className="rounded-lg border border-gray-200 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{user.name}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{tasks.length}</span>
                    </div>
                    {tasks.length === 0 ? (
                      <p className="text-sm text-gray-500">No assigned tasks.</p>
                    ) : (
                      <ul className="space-y-2">
                        {tasks.slice(0, 4).map((task) => (
                          <li key={task.id} className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
                            <span className="font-medium text-gray-900">{task.title}</span>
                            <span className="ml-2 text-xs text-gray-500">• {task.projectName}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}

                <div className="rounded-lg border border-dashed border-gray-300 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-gray-900">Unassigned</p>
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">{unassignedTasks.length}</span>
                  </div>
                  {unassignedTasks.length === 0 ? (
                    <p className="text-sm text-gray-500">No unassigned tasks.</p>
                  ) : (
                    <ul className="space-y-2">
                      {unassignedTasks.slice(0, 4).map((task) => (
                        <li key={task.id} className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
                          <span className="font-medium text-gray-900">{task.title}</span>
                          <span className="ml-2 text-xs text-gray-500">• {task.projectName}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-gray-900">Ownership highlights</h2>
                <ul className="mt-3 space-y-2 text-sm text-gray-600">
                  <li className="flex items-center justify-between"><span>Assigned</span><span className="font-semibold text-gray-900">{totalTasks - unassignedCount}</span></li>
                  <li className="flex items-center justify-between"><span>Unassigned</span><span className="font-semibold text-gray-900">{unassignedCount}</span></li>
                  <li className="flex items-center justify-between"><span>In progress</span><span className="font-semibold text-gray-900">{inProgressCount}</span></li>
                </ul>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-gray-900">Member coverage</h2>
                <p className="mt-2 text-sm text-gray-600">Project membership and assignee selection now stay aligned as work is assigned.</p>
              </div>
            </div>
          </section>
        </>
      )}

      {view === 'activity' && (
        <>
          {summarySection}
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Recent activity</h2>
              <p className="text-xs text-gray-500">Latest task updates across all projects</p>
            </div>
            <div className="space-y-3">
              {recentTasks.length === 0 ? (
                <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-6 text-center text-sm text-gray-500">
                  Activity will appear here once tasks start moving.
                </div>
              ) : (
                recentTasks.map((task) => (
                  <article key={task.id} className="rounded-lg border border-gray-200 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{task.title}</p>
                        <p className="text-xs text-gray-500">{task.projectName}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="rounded-full bg-gray-100 px-2 py-1 font-medium text-gray-700">{task.status}</span>
                        <span>{task._count.comments} comments</span>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </>
      )}

      {view === 'reports' && (
        <>
          {summarySection}
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Project reports</h2>
              <p className="text-xs text-gray-500">Delivery and throughput snapshot</p>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {projects.map((project) => {
                const projectTasks = project.board?.tasks ?? []
                const completedCount = projectTasks.filter((task) => task.status === 'DONE').length
                const completionRate = projectTasks.length > 0 ? Math.round((completedCount / projectTasks.length) * 100) : 0

                return (
                  <div key={project.id} className="rounded-lg border border-gray-200 p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">{project.name}</h3>
                        <p className="text-xs text-gray-500">{project.members.length} members</p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{completionRate}% done</span>
                    </div>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center justify-between"><span>Total tasks</span><span className="font-semibold text-gray-900">{projectTasks.length}</span></div>
                      <div className="flex items-center justify-between"><span>Done</span><span className="font-semibold text-gray-900">{completedCount}</span></div>
                      <div className="flex items-center justify-between"><span>Open comments</span><span className="font-semibold text-gray-900">{projectTasks.reduce((sum, task) => sum + task._count.comments, 0)}</span></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </>
      )}

      {view === 'settings' && (
        <>
          {summarySection}
          <section className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">Workspace members</h2>
                <p className="text-xs text-gray-500">{users.length} total users</p>
              </div>
              <div className="space-y-3">
                {users.map((user) => {
                  const assignedCount = allTasks.filter((task) => task.assigneeId === user.id).length
                  const memberProjects = projects.filter((project) => project.members.some((member) => member.userId === user.id)).length

                  return (
                    <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{user.name}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                      <div className="flex gap-3 text-xs text-gray-500">
                        <span>{memberProjects} projects</span>
                        <span>{assignedCount} tasks</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-gray-900">Workspace defaults</h2>
                <ul className="mt-3 space-y-2 text-sm text-gray-600">
                  <li>Board sorting and filters now work per session.</li>
                  <li>Project members drive assignment and comment participation.</li>
                  <li>Quick create is available from the global header.</li>
                </ul>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-gray-900">Operational notes</h2>
                <p className="mt-2 text-sm text-gray-600">Use project boards to fine-tune membership, review comments, and validate realtime sync.</p>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
