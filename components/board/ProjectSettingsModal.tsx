'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateProject, deleteProject } from '@/lib/actions'

interface ProjectSettingsModalProps {
  projectId: string
  projectName: string
  projectDescription?: string | null
  onClose: () => void
  onUpdate: (name: string, description: string | null) => void
}

const INPUT_BASE_CLASS =
  'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100'

export default function ProjectSettingsModal({
  projectId,
  projectName,
  projectDescription,
  onClose,
  onUpdate,
}: ProjectSettingsModalProps) {
  const [name, setName] = useState(projectName)
  const [description, setDescription] = useState(projectDescription ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || isSaving || isDeleting) return
      if (confirmDelete) {
        setConfirmDelete(false)
        return
      }
      onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [confirmDelete, isDeleting, isSaving, onClose])

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return

    setIsSaving(true)
    setError(null)

    try {
      await updateProject(projectId, {
        name: name.trim(),
        description: description.trim() || null,
      })
      onUpdate(name.trim(), description.trim() || null)
      onClose()
    } catch (saveError) {
      console.error('[ProjectSettingsModal] Failed to update project', saveError)
      setError('Failed to save changes. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    setError(null)

    try {
      await deleteProject(projectId)
      router.push('/dashboard')
      router.refresh()
    } catch (deleteError) {
      console.error('[ProjectSettingsModal] Failed to delete project', deleteError)
      setError('Failed to delete project. Please try again.')
      setIsDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Project settings</p>
            <h2 className="text-lg font-semibold text-gray-900">Edit project</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving || isDeleting}
            className="rounded p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40"
            aria-label="Close project settings"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <form onSubmit={handleSave} className="space-y-4 px-5 py-4">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-600">Project name *</label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Project name"
              required
              className={INPUT_BASE_CLASS}
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-600">Description</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="What is this project about?"
              className={`${INPUT_BASE_CLASS} resize-y`}
            />
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={isSaving || isDeleting}
              className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Delete project
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving || isDeleting}
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || isDeleting || !name.trim()}
                className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-5 shadow-xl">
            <h3 className="mb-1 text-base font-semibold text-gray-900">Delete project?</h3>
            <p className="mb-4 text-sm text-gray-600">
              This will permanently remove the project and all its tasks and comments. This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={isDeleting}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
