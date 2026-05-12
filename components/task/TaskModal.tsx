'use client'

import { useMemo, useState } from 'react'
import { TaskStatus, TaskPriority, createTask, updateTask, deleteTask } from '@/lib/actions'
import { BoardTask, BoardUser } from '@/lib/board-types'

interface TaskModalProps {
  mode: 'create' | 'edit'
  task?: BoardTask
  defaultStatus?: TaskStatus
  boardId?: string
  users: BoardUser[]
  onClose: () => void
  onSave: (task: BoardTask) => void
  onDelete?: () => void
}

const INPUT_BASE_CLASS =
  'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100'

const FIELD_LABEL_CLASS = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-600'

function getReadableDate(dateValue: string | Date) {
  return new Date(dateValue).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function TaskModal({
  mode,
  task,
  defaultStatus = 'TODO',
  boardId,
  users,
  onClose,
  onSave,
  onDelete,
}: TaskModalProps) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [status, setStatus] = useState<TaskStatus>((task?.status as TaskStatus) ?? defaultStatus)
  const [priority, setPriority] = useState<TaskPriority>((task?.priority as TaskPriority) ?? 'MEDIUM')
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? '')
  const [loading, setLoading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const createdAt = useMemo(() => (task ? getReadableDate(task.createdAt) : null), [task])
  const updatedAt = useMemo(() => (task ? getReadableDate(task.updatedAt) : null), [task])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    setError(null)
    setFeedback(null)

    try {
      if (mode === 'create' && boardId) {
        const created = await createTask({
          title: title.trim(),
          description: description.trim() || undefined,
          status,
          priority,
          assigneeId: assigneeId || undefined,
          boardId,
        })
        setFeedback('Task created')
        onSave(created)
      } else if (mode === 'edit' && task) {
        const updated = await updateTask(task.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          status,
          priority,
          assigneeId: assigneeId || null,
        })
        setFeedback('Changes saved')
        onSave(updated)
      }
    } catch (err) {
      console.error('[TaskModal] Failed to save task', err)
      setError(mode === 'create' ? 'Failed to create task. Please try again.' : 'Failed to save changes. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!task) return
    setLoading(true)
    setError(null)
    setFeedback(null)

    try {
      await deleteTask(task.id)
      onDelete?.()
    } catch (err) {
      console.error('[TaskModal] Failed to delete task', err)
      setError('Failed to delete task. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/45 p-2 sm:p-6" role="dialog" aria-modal="true">
      <div className="mx-auto my-2 flex min-h-[calc(100vh-1rem)] w-full max-w-5xl items-start justify-center sm:my-6 sm:min-h-[calc(100vh-3rem)]">
        <div className="flex w-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
          <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                {mode === 'create' ? 'Create task' : `Task #${task?.id.slice(0, 8).toUpperCase()}`}
              </p>
              <h2 className="truncate text-base font-semibold text-gray-900 sm:text-lg">
                {mode === 'create' ? 'New task details' : 'Task details'}
              </h2>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="rounded p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={`Close ${mode === 'create' ? 'new task' : 'edit task'} modal`}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </header>

          <form onSubmit={handleSubmit} className="grid max-h-[calc(100vh-8rem)] grid-cols-1 overflow-y-auto md:grid-cols-[minmax(0,1fr)_280px]" aria-busy={loading}>
            <section className="space-y-4 border-b border-gray-200 px-4 py-4 md:border-b-0 md:border-r md:px-5">
              {(error || feedback) && (
                <div
                  className={`rounded-md border px-3 py-2 text-sm ${
                    error
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {error ?? feedback}
                </div>
              )}

              <div>
                <label className={FIELD_LABEL_CLASS}>Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Summarize the task"
                  className={INPUT_BASE_CLASS}
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className={FIELD_LABEL_CLASS}>Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add details, acceptance criteria, and context"
                  rows={6}
                  className={`${INPUT_BASE_CLASS} resize-y`}
                />
              </div>

              <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50/70 p-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">Activity</h3>
                <ol className="space-y-2 text-xs text-gray-600">
                  <li className="rounded border border-gray-200 bg-white px-2.5 py-2">Activity timeline will appear here soon.</li>
                  <li className="rounded border border-gray-200 bg-white px-2.5 py-2">Realtime board updates are enabled for this task.</li>
                </ol>
              </div>

              <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50/70 p-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">Comments</h3>
                <p className="text-xs text-gray-500">Comment threads are coming soon.</p>
              </div>

              <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50/70 p-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">Subtasks</h3>
                <p className="text-xs text-gray-500">Break this work into smaller checklist items.</p>
              </div>
            </section>

            <aside className="space-y-3 px-4 py-4 sm:px-5 md:bg-gray-50/70">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">Task properties</h3>

              <div>
                <label className={FIELD_LABEL_CLASS}>Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className={INPUT_BASE_CLASS}
                >
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="DONE">Done</option>
                </select>
              </div>

              <div>
                <label className={FIELD_LABEL_CLASS}>Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className={INPUT_BASE_CLASS}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </div>

              <div>
                <label className={FIELD_LABEL_CLASS}>Assignee</label>
                <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={INPUT_BASE_CLASS}>
                  <option value="">Unassigned</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={FIELD_LABEL_CLASS}>Labels</label>
                <input
                  type="text"
                  placeholder="backend, design, qa"
                  className={INPUT_BASE_CLASS}
                  defaultValue=""
                  readOnly
                  aria-readonly
                />
              </div>

              <div>
                <label className={FIELD_LABEL_CLASS}>Due date</label>
                <input type="date" className={INPUT_BASE_CLASS} />
              </div>

              <div className="space-y-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600">
                <p>
                  <span className="font-semibold text-gray-700">Created:</span> {createdAt ?? '—'}
                </p>
                <p>
                  <span className="font-semibold text-gray-700">Updated:</span> {updatedAt ?? '—'}
                </p>
                <p>
                  <span className="font-semibold text-gray-700">Board ID:</span> {task?.boardId ?? boardId ?? '—'}
                </p>
              </div>
            </aside>

            <footer className="sticky bottom-0 col-span-full flex items-center gap-2 border-t border-gray-200 bg-white px-4 py-3 sm:px-5">
              {mode === 'edit' && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                >
                  Delete
                </button>
              )}
              <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !title.trim()}
                  className="flex-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? 'Saving…' : mode === 'create' ? 'Create task' : 'Save changes'}
                </button>
              </div>
            </footer>
          </form>
        </div>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-5 shadow-xl">
            <h3 className="mb-1 text-base font-semibold text-gray-900">Delete task?</h3>
            <p className="mb-4 text-sm text-gray-600">This action is permanent and cannot be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={loading}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="flex-1 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
