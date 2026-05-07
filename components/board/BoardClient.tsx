'use client'

import { useState, useCallback, useEffect } from 'react'
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
import { getSupabaseBrowserClient } from '@/lib/supabase'
import Column from './Column'
import TaskCard from '../task/TaskCard'

type User = {
  id: string
  name: string
  email: string
}

type Task = {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  assigneeId: string | null
  assignee: User | null
  boardId: string
  createdAt: string | Date
  updatedAt: string | Date
}

type Board = {
  id: string
  tasks: Task[]
}

interface BoardClientProps {
  board: Board
  users: User[]
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

function parseBoardTasks(data: unknown): Task[] | null {
  if (!data || typeof data !== 'object' || !('tasks' in data)) return null

  const tasks = (data as { tasks?: unknown }).tasks
  if (!Array.isArray(tasks)) return null

  const parsedTasks: Task[] = []
  for (const task of tasks) {
    if (!task || typeof task !== 'object') return null
    const candidate = task as Partial<Task>
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

export default function BoardClient({ board, users, projectId }: BoardClientProps) {
  const [tasks, setTasks] = useState<Task[]>(board.tasks)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [moveError, setMoveError] = useState<string | null>(null)

  const refreshBoard = useCallback(async () => {
    try {
      const res = await fetch(`/api/board?projectId=${projectId}`, { cache: 'no-store' })
      if (!res.ok) return
      const data: unknown = await res.json()
      const parsedTasks = parseBoardTasks(data)
      if (parsedTasks) setTasks(parsedTasks)
    } catch (error) {
      console.warn('Board polling error:', error)
    }
  }, [projectId])

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    if (supabase) return

    const interval = setInterval(() => {
      void refreshBoard()
    }, 20000)

    return () => clearInterval(interval)
  }, [refreshBoard])

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return

    const channel = supabase
      .channel(`board:${board.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Task', filter: `boardId=eq.${board.id}` },
        () => {
          void refreshBoard()
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [board.id, refreshBoard])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        // Delay and tolerance prevent accidental drags while scrolling on touch devices.
        delay: 200,
        tolerance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const getTasksByStatus = useCallback(
    (status: string) => tasks.filter((t) => t.status === status),
    [tasks]
  )

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id)
    setActiveTask(task ?? null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
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
      setTimeout(() => setMoveError(null), 3000)
    }
  }

  const handleTaskUpdate = (updatedTask: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)))
  }

  const handleTaskDelete = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
  }

  const handleTaskCreate = (newTask: Task) => {
    setTasks((prev) => [...prev, newTask])
  }

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
      <div className="h-full overflow-x-auto">
        <div className="flex gap-4 p-4 sm:p-6 h-full min-w-max">
          {COLUMNS.map((col) => (
            <Column
              key={col.id}
              id={col.id}
              label={col.label}
              color={col.color}
              tasks={getTasksByStatus(col.id)}
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
