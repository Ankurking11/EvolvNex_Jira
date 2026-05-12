'use client'

import { memo, useMemo, useRef, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { BoardTask, BoardUser } from '@/lib/board-types'
import TaskModal from './TaskModal'

interface TaskCardProps {
  task: BoardTask
  users: BoardUser[]
  onUpdate: (task: BoardTask) => void
  onDelete: (taskId: string) => void
  isDragging?: boolean
}

const OPEN_GESTURE_TOLERANCE_PX = 6

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  HIGH: { label: 'High', className: 'bg-red-50 text-red-700 border-red-200' },
  MEDIUM: { label: 'Medium', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  LOW: { label: 'Low', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function getRelativeTime(dateValue: string | Date) {
  const date = new Date(dateValue)
  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.round(diffMs / 60000)
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, 'minute')
  }

  const diffHours = Math.round(diffMinutes / 60)
  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, 'hour')
  }

  const diffDays = Math.round(diffHours / 24)
  return formatter.format(diffDays, 'day')
}

function TaskCard({ task, users, onUpdate, onDelete, isDragging }: TaskCardProps) {
  const [showModal, setShowModal] = useState(false)
  const dragIntentRef = useRef(false)
  const suppressClickUntilRef = useRef(0)
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } = useSortable({
    id: task.id,
    disabled: isDragging,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const priority = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.MEDIUM
  const relativeUpdate = useMemo(() => getRelativeTime(task.updatedAt), [task.updatedAt])
  const isDragPreview = Boolean(isDragging)
  const isMoving = Boolean(isDragging || isSortableDragging)

  return (
    <>
      <article
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onPointerDown={(event) => {
          pointerStartRef.current = { x: event.clientX, y: event.clientY }
          dragIntentRef.current = false
        }}
        onPointerMove={(event) => {
          const start = pointerStartRef.current
          if (!start || dragIntentRef.current) return
          const movedX = Math.abs(event.clientX - start.x)
          const movedY = Math.abs(event.clientY - start.y)
          if (movedX > OPEN_GESTURE_TOLERANCE_PX || movedY > OPEN_GESTURE_TOLERANCE_PX) {
            dragIntentRef.current = true
          }
        }}
        onPointerUp={() => {
          pointerStartRef.current = null
          if (dragIntentRef.current) {
            suppressClickUntilRef.current = Date.now() + 140
          }
          dragIntentRef.current = false
        }}
        onClick={() => {
          if (Date.now() < suppressClickUntilRef.current || dragIntentRef.current || isMoving || isDragPreview) return
          setShowModal(true)
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if ((event.key === 'Enter' || event.key === ' ') && !isMoving && !isDragPreview) {
            event.preventDefault()
            setShowModal(true)
          }
        }}
        className={`group rounded-md border bg-white px-2.5 py-2 shadow-sm transition-all duration-150 ${
          isDragPreview
            ? 'pointer-events-none border-blue-300 shadow-xl ring-2 ring-blue-200'
            : 'cursor-pointer border-gray-200 hover:border-blue-200 hover:shadow-md'
        } ${isMoving ? 'opacity-75 ring-2 ring-blue-300' : ''}`}
      >
        <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px]">
          <span className="font-semibold text-gray-500">#{task.id.slice(0, 8).toUpperCase()}</span>
          <div className="flex items-center gap-1.5">
            <span className={`rounded border px-1.5 py-0.5 font-medium ${priority.className}`}>{priority.label}</span>
            <button
              type="button"
              onClick={(event) => event.stopPropagation()}
              className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              title="Task actions"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M3.5 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0Zm5 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0Zm5 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0Z" />
              </svg>
            </button>
          </div>
        </div>

        <h4 className="line-clamp-2 text-sm font-semibold leading-5 text-gray-900">{task.title}</h4>

        {task.description && (
          <p className="mt-1 line-clamp-2 text-xs leading-4 text-gray-600">{task.description}</p>
        )}

        <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-gray-500">
          <div className="flex min-w-0 items-center gap-1.5">
            {task.assignee ? (
              <div
                title={task.assignee.name}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[10px] font-semibold text-white"
              >
                {getInitials(task.assignee.name)}
              </div>
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-gray-300 bg-gray-50 text-[10px] font-semibold text-gray-400">
                ?
              </div>
            )}
            <span className="truncate">{relativeUpdate}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-600">{task.status.replaceAll('_', ' ')}</span>
            <span className="inline-flex items-center gap-1">
              <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M18 10c0 .552-.448 1-1 1H6.414l3.293 3.293a1 1 0 11-1.414 1.414l-5-5a.997.997 0 010-1.414l5-5a1 1 0 111.414 1.414L6.414 9H17c.552 0 1 .448 1 1Z" />
              </svg>
              0
            </span>
            <span className="inline-flex items-center gap-1">
              <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M4 5a3 3 0 013-3h6a3 3 0 013 3v10a3 3 0 01-3 3H7a3 3 0 01-3-3V5Zm3-1a1 1 0 00-1 1v10a1 1 0 001 1h6a1 1 0 001-1V5a1 1 0 00-1-1H7Z" />
              </svg>
              0
            </span>
          </div>
        </div>
      </article>

      {showModal && (
        <TaskModal
          mode="edit"
          task={task}
          users={users}
          onClose={() => setShowModal(false)}
          onSave={(updated) => {
            onUpdate(updated)
            setShowModal(false)
          }}
          onDelete={() => {
            onDelete(task.id)
            setShowModal(false)
          }}
        />
      )}
    </>
  )
}

export default memo(TaskCard)
