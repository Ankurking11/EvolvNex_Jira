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
const TOUCH_ACTIVATION_DELAY_MS = 150
const TOUCH_ACTIVATION_TOLERANCE_PX = 6

interface BoardClientProps {
  board: BoardData
  users: BoardUser[]
  projectId: string
}

const COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'TODO', label: 'To Do', color: 'bg-gray-100' },
  { id: 'IN_PROGRESS', label: 'In Progress', color: 'bg-blue-50' },
  { id: 'DONE', label: 'Done', color: 'bg-green-50' },
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

export default function BoardClient({ board, users, projectId }: BoardClientProps) {
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
        // Delay and tolerance prevent accidental drags while scrolling on touch devices.
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

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id)
    setActiveTask(task ?? null)
  }, [tasks])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
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
  }, [tasks])

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
        <div className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50">
          {moveError}
        </div>
      )}
      {syncError && (
        <div className="fixed top-4 right-4 bg-amber-100 border border-amber-300 text-amber-800 px-4 py-2 rounded-lg shadow text-xs sm:text-sm z-50">
          {syncError}
        </div>
      )}
      <div className="h-full overflow-x-auto">
        <div className="flex gap-4 p-4 sm:p-6 h-full min-w-max">
          {isRefreshing && (
            <div className="fixed right-4 top-16 text-xs text-gray-500 bg-white/90 rounded px-2 py-1 border border-gray-200 z-40">
              Syncing…
            </div>
          )}
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
      <DragOverlay>
        {activeTask && (
          <TaskCard
            task={activeTask}
            users={users}
            onUpdate={handleTaskUpdate}
            onDelete={handleTaskDelete}
            isDragging
          />
        )}
      </DragOverlay>
    </DndContext>
  )
}
