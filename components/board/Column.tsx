'use client'

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { TaskStatus } from '@/lib/actions'
import TaskCard from '../task/TaskCard'
import TaskModal from '../task/TaskModal'

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

interface ColumnProps {
  id: TaskStatus
  label: string
  color: string
  tasks: Task[]
  users: User[]
  boardId: string
  onTaskUpdate: (task: Task) => void
  onTaskDelete: (taskId: string) => void
  onTaskCreate: (task: Task) => void
}

const STATUS_BADGE: Record<string, string> = {
  TODO: 'bg-gray-200 text-gray-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  DONE: 'bg-green-100 text-green-700',
}

export default function Column({
  id,
  label,
  color,
  tasks,
  users,
  boardId,
  onTaskUpdate,
  onTaskDelete,
  onTaskCreate,
}: ColumnProps) {
  const [showModal, setShowModal] = useState(false)
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div className={`flex flex-col w-72 sm:w-80 rounded-xl ${color} border border-gray-200 ${isOver ? 'ring-2 ring-blue-400' : ''}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[id]}`}>
            {tasks.length}
          </span>
          <h3 className="font-semibold text-gray-800 text-sm">{label}</h3>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-white rounded transition-colors"
          title="Add task"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      <div ref={setNodeRef} className="flex-1 p-3 space-y-2 overflow-y-auto min-h-[200px]">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              users={users}
              onUpdate={onTaskUpdate}
              onDelete={onTaskDelete}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="flex items-center justify-center h-24 text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
            Drop tasks here
          </div>
        )}
      </div>

      {showModal && (
        <TaskModal
          mode="create"
          defaultStatus={id}
          boardId={boardId}
          users={users}
          onClose={() => setShowModal(false)}
          onSave={(task) => {
            onTaskCreate(task as Task)
            setShowModal(false)
          }}
        />
      )}
    </div>
  )
}
