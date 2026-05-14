'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createUser, deleteUser } from '@/lib/actions'

interface SettingsUser {
  id: string
  name: string
  email: string
  role: string
}

interface UserStats {
  memberProjects: number
  assignedCount: number
}

interface UserManagementPanelProps {
  users: SettingsUser[]
  statsByUser: Record<string, UserStats>
}

const INPUT_BASE_CLASS =
  'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100'

export default function UserManagementPanel({ users, statsByUser }: UserManagementPanelProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('MEMBER')
  const [isCreating, setIsCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleAddUser = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim() || !email.trim()) return

    setIsCreating(true)
    setError(null)

    try {
      await createUser({
        name,
        email,
        role,
      })
      setName('')
      setEmail('')
      setRole('MEMBER')
      router.refresh()
    } catch (createError) {
      console.error('[UserManagementPanel] Failed to create user', createError)
      setError(createError instanceof Error ? createError.message : 'Failed to add user. Please try again.')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteUser = async (userId: string, userName: string) => {
    const confirmed = window.confirm(`Delete ${userName}? Existing tasks and comments will remain, and assignments will be cleared.`)
    if (!confirmed) return

    setDeletingId(userId)
    setError(null)

    try {
      await deleteUser(userId)
      router.refresh()
    } catch (deleteError) {
      console.error('[UserManagementPanel] Failed to delete user', deleteError)
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete user. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Workspace members</h2>
        <p className="text-xs text-gray-500">{users.length} total users</p>
      </div>

      <form onSubmit={handleAddUser} className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
        {error && <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-600">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Full name"
              className={INPUT_BASE_CLASS}
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-600">Email *</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              className={INPUT_BASE_CLASS}
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-600">Role (optional)</label>
            <select value={role} onChange={(event) => setRole(event.target.value)} className={INPUT_BASE_CLASS}>
              <option value="MEMBER">MEMBER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="submit"
            disabled={isCreating || !name.trim() || !email.trim()}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCreating ? 'Adding…' : 'Add user'}
          </button>
        </div>
      </form>

      <div className="space-y-3">
        {users.map((user) => {
          const stats = statsByUser[user.id] ?? { memberProjects: 0, assignedCount: 0 }
          const isDeleting = deletingId === user.id

          return (
            <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-3 text-xs text-gray-500">
                  <span>{user.role}</span>
                  <span>{stats.memberProjects} projects</span>
                  <span>{stats.assignedCount} tasks</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteUser(user.id, user.name)}
                  disabled={isDeleting || isCreating}
                  className="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isDeleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
