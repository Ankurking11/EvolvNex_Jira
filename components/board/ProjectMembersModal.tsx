'use client'

import { useEffect, useState } from 'react'
import { updateProjectMembers } from '@/lib/actions'
import { BoardUser } from '@/lib/board-types'

interface ProjectMembersModalProps {
  projectId: string
  allUsers: BoardUser[]
  members: BoardUser[]
  onClose: () => void
  onSave: (members: BoardUser[]) => void
}

export default function ProjectMembersModal({
  projectId,
  allUsers,
  members,
  onClose,
  onSave,
}: ProjectMembersModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(members.map((member) => member.id))
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSaving, onClose])

  const toggleUser = (userId: string) => {
    setSelectedIds((previous) =>
      previous.includes(userId) ? previous.filter((value) => value !== userId) : [...previous, userId]
    )
  }

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)

    try {
      const nextMembers = await updateProjectMembers(projectId, selectedIds)
      onSave(nextMembers)
      onClose()
    } catch (saveError) {
      console.error('[ProjectMembersModal] Failed to save members', saveError)
      setError('Failed to update members. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Project members</p>
            <h2 className="text-lg font-semibold text-gray-900">Manage board access</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close members modal"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="space-y-3 px-5 py-4">
          {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <p className="text-sm text-gray-600">Choose which team members should appear for assignment, filters, and comments.</p>

          <div className="max-h-80 space-y-2 overflow-y-auto">
            {allUsers.map((user) => {
              const isSelected = selectedIds.includes(user.id)

              return (
                <label
                  key={user.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 transition ${
                    isSelected ? 'border-blue-200 bg-blue-50/70' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleUser(user.id)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{user.name}</p>
                    <p className="truncate text-xs text-gray-500">{user.email}</p>
                  </div>
                </label>
              )
            })}
          </div>
        </div>

        <footer className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-5 py-4">
          <p className="text-xs text-gray-500">{selectedIds.length} members selected</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Saving…' : 'Save members'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
