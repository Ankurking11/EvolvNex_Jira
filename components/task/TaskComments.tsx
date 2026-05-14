'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BoardComment, BoardUser } from '@/lib/board-types'
import { createTaskComment } from '@/lib/actions'
import { getSupabaseBrowserClient } from '@/lib/supabase'

const POLLING_INTERVAL_MS = 15000

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function getAuthorName(comment: BoardComment) {
  return comment.author?.name ?? 'Unknown user'
}

function getRelativeTime(dateValue: string | Date) {
  const date = new Date(dateValue)
  const elapsedMinutes = Math.round((Date.now() - date.getTime()) / 60000)
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

  if (Math.abs(elapsedMinutes) < 60) {
    return formatter.format(-elapsedMinutes, 'minute')
  }

  const elapsedHours = Math.round(elapsedMinutes / 60)
  if (Math.abs(elapsedHours) < 24) {
    return formatter.format(-elapsedHours, 'hour')
  }

  return formatter.format(-Math.round(elapsedHours / 24), 'day')
}

interface TaskCommentsProps {
  taskId: string
  users: BoardUser[]
  defaultAuthorId?: string | null
}

export default function TaskComments({ taskId, users, defaultAuthorId }: TaskCommentsProps) {
  const [comments, setComments] = useState<BoardComment[]>([])
  const [content, setContent] = useState('')
  const [authorId, setAuthorId] = useState(defaultAuthorId ?? users[0]?.id ?? '')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [isRealtimeHealthy, setIsRealtimeHealthy] = useState(false)
  const refreshInFlightRef = useRef(false)
  const queuedRefreshRef = useRef(false)
  const isMountedRef = useRef(true)
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])

  const selectedAuthorId =
    (authorId && users.some((user) => user.id === authorId) ? authorId : null) ??
    (defaultAuthorId && users.some((user) => user.id === defaultAuthorId) ? defaultAuthorId : null) ??
    users[0]?.id ??
    ''

  const refreshComments = useCallback(
    async ({ showLoading = false }: { showLoading?: boolean } = {}) => {
      if (showLoading) {
        setIsLoading(true)
      }

      if (refreshInFlightRef.current) {
        queuedRefreshRef.current = true
        return
      }

      refreshInFlightRef.current = true

      try {
        do {
          queuedRefreshRef.current = false

          try {
            const response = await fetch(`/api/tasks/${taskId}/comments`, {
              headers: { 'cache-control': 'no-cache' },
            })

            if (!response.ok) {
              throw new Error(`Failed to load comments (${response.status})`)
            }

            const nextComments = (await response.json()) as BoardComment[]
            if (!isMountedRef.current) {
              return
            }
            setComments(nextComments)
            setSyncError(null)
          } catch (refreshError) {
            if (!isMountedRef.current) {
              return
            }
            console.warn('[TaskComments] Failed to refresh comments', refreshError)
            setSyncError('Comment sync is delayed. Retrying automatically.')
          }
        } while (queuedRefreshRef.current && isMountedRef.current)
      } finally {
        refreshInFlightRef.current = false
        if (isMountedRef.current) {
          setIsLoading(false)
        }
      }
    },
    [taskId]
  )

  useEffect(() => {
    queuedRefreshRef.current = false
    void refreshComments({ showLoading: true })
  }, [refreshComments, taskId])

  useEffect(
    () => () => {
      isMountedRef.current = false
    },
    []
  )

  useEffect(() => {
    if (supabase && isRealtimeHealthy) return

    const interval = window.setInterval(() => {
      void refreshComments()
    }, POLLING_INTERVAL_MS)

    return () => window.clearInterval(interval)
  }, [isRealtimeHealthy, refreshComments, supabase])

  useEffect(() => {
    if (!supabase) return

    const channel = supabase
      .channel(`task-comments:${taskId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments', filter: `task_id=eq.${taskId}` },
        () => {
          void refreshComments()
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsRealtimeHealthy(true)
          setSyncError(null)
          return
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setIsRealtimeHealthy(false)
          setSyncError('Realtime comment sync disconnected. Falling back to refresh.')
        }
      })

    return () => {
      setIsRealtimeHealthy(false)
      void supabase.removeChannel(channel)
    }
  }, [refreshComments, supabase, taskId])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!content.trim() || !selectedAuthorId) return

    setIsSaving(true)
    setError(null)

    try {
      const createdComment = await createTaskComment({
        taskId,
        authorId: selectedAuthorId,
        content,
      })

      setComments((previous) => [...previous, createdComment])
      setContent('')
    } catch (saveError) {
      console.error('[TaskComments] Failed to create comment', saveError)
      setError('Failed to save comment. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  if (users.length === 0) {
    return <p className="text-xs text-gray-500">Add team members before creating comments.</p>
  }

  return (
    <div className="space-y-3">
      {(error || syncError) && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {error ?? syncError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid gap-2 sm:grid-cols-[160px_minmax(0,1fr)]">
          <select
            value={selectedAuthorId}
            onChange={(event) => setAuthorId(event.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={3}
            placeholder="Add a comment"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-gray-500">
            {isRealtimeHealthy ? 'Realtime updates enabled' : 'Automatic refresh enabled'}
          </p>
          <button
            type="submit"
            disabled={isSaving || !content.trim() || !selectedAuthorId}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? 'Posting…' : 'Add comment'}
          </button>
        </div>
      </form>

      <div className="space-y-2">
        {isLoading ? (
          <div className="rounded-md border border-gray-200 bg-white px-3 py-3 text-xs text-gray-500">Loading comments…</div>
        ) : comments.length === 0 ? (
          <div className="rounded-md border border-dashed border-gray-300 bg-white px-3 py-4 text-xs text-gray-500">
            No comments yet. Start the discussion here.
          </div>
        ) : (
          comments.map((comment) => (
            <article key={comment.id} className="rounded-md border border-gray-200 bg-white px-3 py-3">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-[10px] font-semibold text-white">
                  {getInitials(getAuthorName(comment))}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-gray-800">{getAuthorName(comment)}</p>
                  <p className="text-[11px] text-gray-500">{getRelativeTime(comment.createdAt)}</p>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm text-gray-700">{comment.content}</p>
            </article>
          ))
        )}
      </div>
    </div>
  )
}
