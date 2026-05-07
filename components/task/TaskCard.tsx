'use client'

import { memo, useState } from 'react'
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

const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  HIGH: { label: 'High', color: 'text-red-600 bg-red-50', dot: 'bg-red-500' },
  MEDIUM: { label: 'Medium', color: 'text-yellow-600 bg-yellow-50', dot: 'bg-yellow-500' },
  LOW: { label: 'Low', color: 'text-green-600 bg-green-50', dot: 'bg-green-500' },
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function TaskCard({ task, users, onUpdate, onDelete, isDragging }: TaskCardProps) {
  const [showModal, setShowModal] = useState(false)
  
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } = useSortable({
    id: task.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const priority = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.MEDIUM

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        className={`bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing ${
          (isDragging || isSortableDragging) ? 'opacity-50 shadow-lg ring-2 ring-blue-400' : ''
        }`}
      >
        <div {...listeners} className="flex items-start gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 leading-tight line-clamp-2">{task.title}</p>
          </div>
          <svg className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </div>

        {task.description && (
          <p className="text-xs text-gray-500 mb-2 line-clamp-2">{task.description}</p>
        )}

        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded flex items-center gap-1 ${priority.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${priority.dot}`} />
            {priority.label}
          </span>

          <div className="flex items-center gap-1">
            {task.assignee && (
              <div
                title={task.assignee.name}
                className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-semibold"
              >
                {getInitials(task.assignee.name)}
              </div>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setShowModal(true) }}
              className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-gray-600 rounded hover:bg-gray-100 transition-colors"
              title="Edit task"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

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
