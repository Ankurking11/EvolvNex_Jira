'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createProject, createTask, TaskPriority, TaskStatus } from '@/lib/actions'
import { BoardUser } from '@/lib/board-types'

interface QuickCreateProject {
  id: string
  name: string
  boardId: string | null
}

interface GlobalCreateButtonProps {
  projects: QuickCreateProject[]
  users: BoardUser[]
}

type CreateMode = 'project' | 'task'

const INPUT_CLASS =
  'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100'

function getDefaultTaskProjectId(projects: QuickCreateProject[], currentProjectId?: string) {
  if (currentProjectId && projects.some((project) => project.id === currentProjectId)) {
    return currentProjectId
  }

  return projects[0]?.id ?? ''
}

export default function GlobalCreateButton({ projects, users }: GlobalCreateButtonProps) {
  const taskProjects = useMemo(() => projects.filter((project) => project.boardId), [projects])
  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState<CreateMode>('task')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [projectId, setProjectId] = useState(() => getDefaultTaskProjectId(taskProjects))
  const [status, setStatus] = useState<TaskStatus>('TODO')
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM')
  const [assigneeId, setAssigneeId] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isSaving])

  const selectedProject = useMemo(() => taskProjects.find((project) => project.id === projectId) ?? taskProjects[0] ?? null, [projectId, taskProjects])

  const resetState = () => {
    setName('')
    setDescription('')
    setStatus('TODO')
    setPriority('MEDIUM')
    setAssigneeId('')
    setError(null)
  }

  const closeModal = () => {
    setIsOpen(false)
    resetState()
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return

    setIsSaving(true)
    setError(null)

    try {
      if (mode === 'project') {
        const project = await createProject({
          name: name.trim(),
          description: description.trim() || undefined,
        })

        closeModal()
        router.push(`/project/${project.id}`)
        router.refresh()
        return
      }

      if (!selectedProject?.boardId) {
        throw new Error('Project board not found')
      }

      await createTask({
        title: name.trim(),
        description: description.trim() || undefined,
        status,
        priority,
        assigneeId: assigneeId || undefined,
        boardId: selectedProject.boardId,
      })

      closeModal()
      router.push(`/project/${selectedProject.id}`)
      router.refresh()
    } catch (saveError) {
      console.error('[GlobalCreateButton] Failed to create item', saveError)
      setError(mode === 'project' ? 'Failed to create project. Please try again.' : 'Failed to create task. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMode(taskProjects.length > 0 ? 'task' : 'project')
          setProjectId((currentProjectId) => getDefaultTaskProjectId(taskProjects, currentProjectId))
          setIsOpen(true)
        }}
        className="rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
      >
        + Create
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[60] overflow-y-auto bg-black/50 p-4"
          role="presentation"
          onClick={() => {
            if (!isSaving) {
              closeModal()
            }
          }}
        >
          <div className="flex min-h-full items-center justify-center">
            <div
              className="w-full max-w-xl overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="global-create-title"
              aria-describedby="global-create-description"
              onClick={(event) => event.stopPropagation()}
            >
              <header className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Quick create</p>
                  <h2 id="global-create-title" className="text-lg font-semibold text-gray-900">
                    Create a new {mode}
                  </h2>
                  <p id="global-create-description" className="mt-1 text-sm text-gray-500">
                    {mode === 'task'
                      ? 'Choose a project, confirm its board, and add task details.'
                      : 'Add a project name and optional description.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSaving}
                  className="rounded p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Close quick create modal"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </header>

              <div className="border-b border-gray-200 px-5 py-3">
                <div className="inline-flex rounded-lg bg-gray-100 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('task')
                      setProjectId((currentProjectId) => getDefaultTaskProjectId(taskProjects, currentProjectId))
                    }}
                    disabled={taskProjects.length === 0}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                      mode === 'task' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    Task
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('project')}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                      mode === 'project' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Project
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
                {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

                {mode === 'task' && taskProjects.length === 0 ? (
                  <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-4 text-sm text-gray-600">
                    Create a project first before creating a task.
                  </div>
                ) : (
                  <>
                    {mode === 'task' && (
                      <div className="space-y-3">
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-600">Project</label>
                          <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className={INPUT_CLASS}>
                            {taskProjects.map((project) => (
                              <option key={project.id} value={project.id}>
                                {project.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                          <p className="font-medium">{selectedProject?.name ?? 'Select a project'}</p>
                          <p className="text-xs text-blue-700">
                            {selectedProject?.boardId ? 'Board auto-selected for this project.' : 'A board is required before creating tasks.'}
                          </p>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                        {mode === 'project' ? 'Project name' : 'Task title'}
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder={mode === 'project' ? 'Platform redesign' : 'Summarize the task'}
                        className={INPUT_CLASS}
                        autoFocus
                        required
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-600">Description</label>
                      <textarea
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        rows={mode === 'project' ? 3 : 4}
                        placeholder={mode === 'project' ? 'What is this project about?' : 'Add supporting details'}
                        className={`${INPUT_CLASS} resize-y`}
                      />
                    </div>

                    {mode === 'task' && (
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-600">Status</label>
                          <select value={status} onChange={(event) => setStatus(event.target.value as TaskStatus)} className={INPUT_CLASS}>
                            <option value="TODO">To Do</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="DONE">Done</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-600">Priority</label>
                          <select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)} className={INPUT_CLASS}>
                            <option value="LOW">Low</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="HIGH">High</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-600">Assignee</label>
                          <select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} className={INPUT_CLASS}>
                            <option value="">Unassigned</option>
                            {users.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={isSaving}
                    className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || !name.trim() || (mode === 'task' && taskProjects.length === 0)}
                    className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? 'Saving…' : mode === 'project' ? 'Create project' : 'Create task'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
