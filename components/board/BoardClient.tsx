'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCorners,
} from '@dnd-kit/core'
import { moveTask, TaskStatus } from '@/lib/actions'
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
  createdAt: Date
  updatedAt: Date
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

export default function BoardClient({ board, users, projectId }: BoardClientProps) {
  const [tasks, setTasks] = useState<Task[]>(board.tasks)
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/board?projectId=${projectId}`)
        if (res.ok) {
          const data = await res.json()
          if (data.tasks) {
            setTasks(data.tasks)
          }
        }
      } catch (_e) {
        // ignore polling errors
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [projectId])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
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

    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus! } : t)))

    try {
      await moveTask(taskId, newStatus)
    } catch (_e) {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: task.status } : t)))
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
