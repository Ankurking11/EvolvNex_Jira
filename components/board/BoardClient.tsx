'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCorners,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { moveTask, TaskStatus } from '@/lib/actions'
import { BoardData, BoardTask, BoardUser } from '@/lib/board-types'
import { getSupabaseBrowserClient } from '@/lib/supabase'
import Column from './Column'
import TaskCard from '../task/TaskCard'

const POLLING_INTERVAL_MS = 20000
const TOUCH_ACTIVATION_DELAY_MS = 180
const TOUCH_ACTIVATION_TOLERANCE_PX = 6

interface BoardClientProps {
  board: BoardData
  users: BoardUser[]
  projectId: string
  projectName?: string
  projectDescription?: string | null
}

const COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'TODO', label: 'To Do', color: 'bg-slate-50' },
  { id: 'IN_PROGRESS', label: 'In Progress', color: 'bg-blue-50/70' },
  { id: 'DONE', label: 'Done', color: 'bg-emerald-50/70' },
]

function isTaskStatus(value: unknown): value is TaskStatus {
  return value === 'TODO' || value === 'IN_PROGRESS' || value === 'DONE'
}

function parseBoardTasks(data: unknown): BoardTask[] | null {
  if (!data || typeof data !== 'object' || !('tasks' in data)) return null

  const tasks = (data as { tasks?: unknown }).tasks
  if (!Array.isArray(tasks)) return null

  const parsedTasks: BoardTask[] = []
  for (const task of tasks) {
    if (!task || typeof task !== 'object') return null
    const candidate = task as Partial<BoardTask>
    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.title !== 'string' ||
      !isTaskStatus(candidate.status) ||
      typeof candidate.priority !== 'string' ||
      typeof candidate.boardId !== 'string' ||
      typeof candidate.createdAt !== 'string' ||
      typeof candidate.updatedAt !== 'string'
    ) {
      return null
    }

    const assignee = candidate.assignee
    if (
      assignee !== null &&
      assignee !== undefined &&
      (typeof assignee !== 'object' ||
        typeof assignee.id !== 'string' ||
        typeof assignee.name !== 'string' ||
        typeof assignee.email !== 'string')
    ) {
      return null
    }

    parsedTasks.push({
      id: candidate.id,
      title: candidate.title,
      description: candidate.description ?? null,
      status: candidate.status,
      priority: candidate.priority,
      assigneeId: candidate.assigneeId ?? null,
      assignee: assignee ?? null,
      boardId: candidate.boardId,
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
    })
  }

  return parsedTasks
}

function hasTaskListChanged(previous: BoardTask[], next: BoardTask[]) {
  if (previous.length !== next.length) return true

  const previousMap = new Map(previous.map((task) => [task.id, task]))

  for (const task of next) {
    const previousTask = previousMap.get(task.id)
    if (
      !previousTask ||
      previousTask.status !== task.status ||
      previousTask.priority !== task.priority ||
      previousTask.assigneeId !== task.assigneeId ||
      String(previousTask.updatedAt) !== String(task.updatedAt)
    ) {
      return true
    }
  }

  return false
}

function upsertTask(previousTasks: BoardTask[], nextTask: BoardTask) {
  const existingTaskIndex = previousTasks.findIndex((task) => task.id === nextTask.id)
  if (existingTaskIndex < 0) return [...previousTasks, nextTask]

  const updatedTasks = [...previousTasks]
  updatedTasks[existingTaskIndex] = nextTask
  return updatedTasks
}

function updateTasksIfChanged(previous: BoardTask[], next: BoardTask[]) {
  return hasTaskListChanged(previous, next) ? next : previous
}

export default function BoardClient({ board, users, projectId, projectName, projectDescription }: BoardClientProps) {
  const [tasks, setTasks] = useState<BoardTask[]>(board.tasks)
  const [activeTask, setActiveTask] = useState<BoardTask | null>(null)
  const [moveError, setMoveError] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [isRealtimeHealthy, setIsRealtimeHealthy] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const latestRefreshRequest = useRef(0)
  const moveErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])

  const refreshBoard = useCallback(async () => {
    const requestId = ++latestRefreshRequest.current
    setIsRefreshing(true)

    try {
      const res = await fetch(`/api/board?projectId=${encodeURIComponent(projectId)}`, {
        headers: { 'cache-control': 'no-cache' },
      })
      if (!res.ok) throw new Error(`Failed to refresh board (${res.status})`)

      const data: unknown = await res.json()
      const parsedTasks = parseBoardTasks(data)

      if (requestId !== latestRefreshRequest.current || !parsedTasks) return

      setTasks((previous) => updateTasksIfChanged(previous, parsedTasks))
      setSyncError(null)
    } catch (error) {
      console.warn('Board polling error:', error)
      setSyncError('Board sync is delayed. Retrying automatically.')
    } finally {
      if (requestId === latestRefreshRequest.current) {
        setIsRefreshing(false)
      }
    }
  }, [projectId])

  useEffect(() => {
    if (supabase && isRealtimeHealthy) return

    const kickoffRefresh = setTimeout(() => {
      void refreshBoard()
    }, 0)

    const interval = setInterval(() => {
      void refreshBoard()
    }, POLLING_INTERVAL_MS)

    return () => {
      clearTimeout(kickoffRefresh)
      clearInterval(interval)
    }
  }, [refreshBoard, isRealtimeHealthy, supabase])

  useEffect(() => {
    if (!supabase) return

    const channel = supabase
      .channel(`board:${board.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `board_id=eq.${board.id}` },
        () => {
          void refreshBoard()
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
          setSyncError('Realtime disconnected. Falling back to periodic refresh.')
        }
      })

    return () => {
      setIsRealtimeHealthy(false)
      void supabase.removeChannel(channel)
    }
  }, [board.id, refreshBoard, supabase])

  useEffect(
    () => () => {
      if (moveErrorTimer.current) {
        clearTimeout(moveErrorTimer.current)
      }
    },
    []
  )

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: TOUCH_ACTIVATION_DELAY_MS,
        tolerance: TOUCH_ACTIVATION_TOLERANCE_PX,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const tasksByStatus = useMemo(
    () =>
      tasks.reduce<Record<TaskStatus, BoardTask[]>>(
        (grouped, task) => {
          if (isTaskStatus(task.status)) {
            grouped[task.status].push(task)
          }
          return grouped
        },
        { TODO: [], IN_PROGRESS: [], DONE: [] }
      ),
    [tasks]
  )

  const totalTasks = tasks.length

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const task = tasks.find((t) => t.id === event.active.id)
      setActiveTask(task ?? null)
    },
    [tasks]
  )

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveTask(null)
      const { active, over } = event
      if (!over) return

      const taskId = active.id as string
      const overId = over.id as string

      let newStatus: TaskStatus | null = null
      if (COLUMNS.some((c) => c.id === overId)) {
        newStatus = overId as TaskStatus
      } else {
        const overTask = tasks.find((t) => t.id === overId)
        if (overTask) newStatus = overTask.status as TaskStatus
      }

      if (!newStatus) return

      const task = tasks.find((t) => t.id === taskId)
      if (!task || task.status === newStatus) return

      const resolvedStatus = newStatus
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: resolvedStatus } : t)))

      try {
        await moveTask(taskId, newStatus)
      } catch (error) {
        console.error('Failed to move task:', error)
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: task.status } : t)))
        setMoveError('Failed to move task. Please try again.')
        if (moveErrorTimer.current) {
          clearTimeout(moveErrorTimer.current)
        }
        moveErrorTimer.current = setTimeout(() => setMoveError(null), 3000)
      }
    },
    [tasks]
  )

  const handleTaskUpdate = useCallback((updatedTask: BoardTask) => {
    setTasks((prev) => upsertTask(prev, updatedTask))
  }, [])

  const handleTaskDelete = useCallback((taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
  }, [])

  const handleTaskCreate = useCallback((newTask: BoardTask) => {
    setTasks((prev) => upsertTask(prev, newTask))
  }, [])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {moveError && (
        <div className="fixed bottom-4 right-4 z-50 rounded-md bg-red-600 px-4 py-2 text-sm text-white shadow-lg">{moveError}</div>
      )}
      {syncError && (
        <div className="fixed right-4 top-[4.5rem] z-50 rounded-md border border-amber-300 bg-amber-100 px-3 py-2 text-xs text-amber-800 shadow sm:text-sm">
          {syncError}
        </div>
      )}

      <div className="flex h-full flex-col overflow-hidden">
        {(projectName || projectDescription) && (
          <div className="border-b border-gray-200 bg-white px-3 py-2 sm:px-4">
            <p className="text-sm font-semibold text-gray-900">{projectName}</p>
            {projectDescription && <p className="line-clamp-1 text-xs text-gray-500">{projectDescription}</p>}
          </div>
        )}
        <div className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 px-3 py-2 backdrop-blur sm:px-4">
          <div className="flex flex-wrap items-center gap-2">
            <button className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50">
              Filters
            </button>
            <button className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50">
              Sort
            </button>
            <button className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50">
              Members ({users.length})
            </button>
            <button className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50">
              Board settings
            </button>

            <div className="relative ml-auto w-full min-w-[180px] max-w-xs sm:w-auto sm:flex-1">
              <svg className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path fillRule="evenodd" d="M12.9 14.32A8 8 0 1114.32 12.9l3.39 3.39a1 1 0 01-1.42 1.42l-3.39-3.39ZM14 8a6 6 0 11-12 0 6 6 0 0112 0Z" clipRule="evenodd" />
              </svg>
              <input
                type="search"
                placeholder="Search tasks"
                className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-8 pr-2 text-xs text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="text-xs text-gray-500">
              {isRefreshing ? (
                <span className="inline-flex items-center gap-1 text-blue-600">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
                  Syncing…
                </span>
              ) : (
                `${totalTasks} tasks`
              )}
            </div>
          </div>
        </div>

        <div className="h-full overflow-x-auto">
          <div className="flex min-w-max gap-3 px-3 py-3 sm:gap-4 sm:px-4 sm:py-4">
            {COLUMNS.map((col) => (
              <Column
                key={col.id}
                id={col.id}
                label={col.label}
                color={col.color}
                tasks={tasksByStatus[col.id]}
                users={users}
                boardId={board.id}
                onTaskUpdate={handleTaskUpdate}
                onTaskDelete={handleTaskDelete}
                onTaskCreate={handleTaskCreate}
              />
            ))}
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeTask && (
          <div className="w-[300px] rotate-1 scale-[1.01] sm:w-[320px]">
            <TaskCard task={activeTask} users={users} onUpdate={handleTaskUpdate} onDelete={handleTaskDelete} isDragging />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
