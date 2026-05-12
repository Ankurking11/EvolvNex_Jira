'use client'

import { memo, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { TaskStatus } from '@/lib/actions'
import { BoardTask, BoardUser } from '@/lib/board-types'
import TaskCard from '../task/TaskCard'
import TaskModal from '../task/TaskModal'

interface ColumnProps {
  id: TaskStatus
  label: string
  color: string
  tasks: BoardTask[]
  users: BoardUser[]
  boardId: string
  onTaskUpdate: (task: BoardTask) => void
  onTaskDelete: (taskId: string) => void
  onTaskCreate: (task: BoardTask) => void
}

const STATUS_BADGE: Record<string, string> = {
  TODO: 'bg-slate-100 text-slate-700 border-slate-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
  DONE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

function Column({
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
    <section
      className={`flex h-full w-[300px] flex-col rounded-lg border border-gray-200 ${color} transition-all sm:w-[320px] ${
        isOver ? 'ring-2 ring-blue-300 shadow-sm' : ''
      }`}
    >
      <header className="sticky top-0 z-20 flex items-center justify-between rounded-t-lg border-b border-gray-200 bg-white/90 px-3 py-2 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[id]}`}>{tasks.length}</span>
          <h3 className="text-sm font-semibold text-gray-800">{label}</h3>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex h-7 w-7 items-center justify-center rounded text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
          title="Add task"
          aria-label={`Add task to ${label}`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </header>

      <div ref={setNodeRef} className="flex-1 space-y-2 overflow-y-auto p-2.5">
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
          <div className="grid h-24 place-items-center rounded-md border border-dashed border-gray-300 bg-white/70 text-center text-xs text-gray-500">
            <span className="px-2">Drop tasks here or create a new one</span>
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
            onTaskCreate(task)
            setShowModal(false)
          }}
        />
      )}
    </section>
  )
}

export default memo(Column)
