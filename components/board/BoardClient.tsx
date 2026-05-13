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
import ProjectMembersModal from './ProjectMembersModal'
import ProjectSettingsModal from './ProjectSettingsModal'

const POLLING_INTERVAL_MS = 20000
const TOUCH_ACTIVATION_DELAY_MS = 180
const TOUCH_ACTIVATION_TOLERANCE_PX = 6

type SortOption = 'updated-desc' | 'updated-asc' | 'priority-desc' | 'priority-asc' | 'title-asc'

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
      typeof candidate.commentCount !== 'number' ||
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
      commentCount: candidate.commentCount,
      boardId: candidate.boardId,
      dueDate: typeof candidate.dueDate === 'string' ? candidate.dueDate : null,
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
    })
  }

  return parsedTasks
}

function parseBoardMembers(data: unknown): BoardUser[] | null {
  if (!data || typeof data !== 'object' || !('members' in data)) return null

  const members = (data as { members?: unknown }).members
  if (!Array.isArray(members)) return null

  const parsedMembers: BoardUser[] = []
  for (const member of members) {
    if (
      !member ||
      typeof member !== 'object' ||
      typeof member.id !== 'string' ||
      typeof member.name !== 'string' ||
      typeof member.email !== 'string'
    ) {
      return null
    }

    parsedMembers.push(member)
  }

  return parsedMembers
}

function hasTaskListChanged(previous: BoardTask[], next: BoardTask[]) {
  if (previous.length !== next.length) return true

  const previousMap = new Map(previous.map((task) => [task.id, task]))

  for (const task of next) {
    const previousTask = previousMap.get(task.id)
    if (
      !previousTask ||
      previousTask.title !== task.title ||
      previousTask.description !== task.description ||
      previousTask.status !== task.status ||
      previousTask.priority !== task.priority ||
      previousTask.assigneeId !== task.assigneeId ||
      previousTask.commentCount !== task.commentCount ||
      String(previousTask.dueDate) !== String(task.dueDate) ||
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

function hasMemberListChanged(previous: BoardUser[], next: BoardUser[]) {
  if (previous.length !== next.length) return true

  return next.some((member, index) => {
    const previousMember = previous[index]
    return !previousMember || previousMember.id !== member.id || previousMember.name !== member.name || previousMember.email !== member.email
  })
}

export default function BoardClient({ board, users, projectId, projectName, projectDescription }: BoardClientProps) {
  const [tasks, setTasks] = useState<BoardTask[]>(board.tasks)
  const [members, setMembers] = useState<BoardUser[]>(board.members)
  const [activeTask, setActiveTask] = useState<BoardTask | null>(null)
  const [moveError, setMoveError] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [isRealtimeHealthy, setIsRealtimeHealthy] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState('ALL')
  const [priorityFilter, setPriorityFilter] = useState('ALL')
  const [sortOption, setSortOption] = useState<SortOption>('updated-desc')
  const [showFilters, setShowFilters] = useState(false)
  const [showSort, setShowSort] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [showProjectSettings, setShowProjectSettings] = useState(false)
  const [currentProjectName, setCurrentProjectName] = useState(projectName ?? '')
  const [currentProjectDescription, setCurrentProjectDescription] = useState(projectDescription ?? null)
  const latestRefreshRequest = useRef(0)
  const moveErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const boardTaskIdsRef = useRef<Set<string>>(new Set(board.tasks.map((task) => task.id)))
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])

  useEffect(() => {
    boardTaskIdsRef.current = new Set(tasks.map((task) => task.id))
  }, [tasks])

  useEffect(() => {
    console.debug('[BoardClient] Project metadata hydrated', {
      projectId,
      boardId: board.id,
      projectName: projectName ?? '',
      hasDescription: Boolean(projectDescription),
      taskIds: board.tasks.map((task) => task.id),
      memberIds: board.members.map((member) => member.id),
    })
  }, [board.id, board.members, board.tasks, projectDescription, projectId, projectName])

  const refreshBoard = useCallback(async () => {
    const requestId = ++latestRefreshRequest.current
    console.debug('[BoardClient] Refreshing board state', { projectId, boardId: board.id, requestId })
    setIsRefreshing(true)

    try {
      const res = await fetch(`/api/board?projectId=${encodeURIComponent(projectId)}`, {
        headers: { 'cache-control': 'no-cache' },
      })
      if (!res.ok) throw new Error(`Failed to refresh board (${res.status})`)

      const data: unknown = await res.json()
      const parsedTasks = parseBoardTasks(data)
      const parsedMembers = parseBoardMembers(data)

      if (requestId !== latestRefreshRequest.current || !parsedTasks) return

      setTasks((previous) => {
        const nextTasks = updateTasksIfChanged(previous, parsedTasks)
        if (nextTasks !== previous) {
          console.debug('[BoardClient] Task state updated from refresh', {
            projectId,
            beforeTaskIds: previous.map((task) => task.id),
            afterTaskIds: nextTasks.map((task) => task.id),
            beforeCount: previous.length,
            afterCount: nextTasks.length,
          })
        }
        return nextTasks
      })
      if (parsedMembers) {
        setMembers((previousMembers) => {
          if (!hasMemberListChanged(previousMembers, parsedMembers)) {
            return previousMembers
          }

          console.debug('[BoardClient] Member state updated from refresh', {
            projectId,
            beforeMemberIds: previousMembers.map((member) => member.id),
            afterMemberIds: parsedMembers.map((member) => member.id),
            beforeCount: previousMembers.length,
            afterCount: parsedMembers.length,
          })

          return parsedMembers
        })
      }
      setSyncError(null)
    } catch (error) {
      console.warn('Board polling error:', error)
      setSyncError('Board sync is delayed. Retrying automatically.')
    } finally {
      if (requestId === latestRefreshRequest.current) {
        setIsRefreshing(false)
      }
    }
  }, [board.id, projectId])

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
          console.debug('[BoardClient] Realtime task event received', { projectId, boardId: board.id })
          void refreshBoard()
        }
      )
      .subscribe((status) => {
        console.debug('[BoardClient] Realtime task channel status', { projectId, boardId: board.id, status })
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
      console.debug('[BoardClient] Realtime task channel removed', { projectId, boardId: board.id })
      setIsRealtimeHealthy(false)
      void supabase.removeChannel(channel)
    }
  }, [board.id, projectId, refreshBoard, supabase])

  useEffect(() => {
    if (!supabase) return

    const channel = supabase
      .channel(`board-comments:${board.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, (payload) => {
        const newRecord =
          payload.new && typeof payload.new === 'object'
            ? (payload.new as { task_id?: unknown })
            : null
        const oldRecord =
          payload.old && typeof payload.old === 'object'
            ? (payload.old as { task_id?: unknown })
            : null

        const taskId =
          (typeof newRecord?.task_id === 'string' ? newRecord.task_id : null) ??
          (typeof oldRecord?.task_id === 'string' ? oldRecord.task_id : null)

        if (taskId && boardTaskIdsRef.current.has(taskId)) {
          console.debug('[BoardClient] Realtime comment event received', { projectId, boardId: board.id, taskId })
          void refreshBoard()
        }
      })
      .subscribe()

    return () => {
      console.debug('[BoardClient] Realtime comment channel removed', { projectId, boardId: board.id })
      void supabase.removeChannel(channel)
    }
  }, [board.id, projectId, refreshBoard, supabase])

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

  const assignableUsers = useMemo(() => {
    const baseUsers = members.length > 0 ? members : users
    const mergedUsers = new Map(baseUsers.map((user) => [user.id, user]))

    for (const task of tasks) {
      if (task.assignee) {
        mergedUsers.set(task.assignee.id, task.assignee)
      }
    }

    return Array.from(mergedUsers.values()).sort((left, right) => left.name.localeCompare(right.name))
  }, [members, tasks, users])

  const tasksByStatus = useMemo(
    () =>
      [...tasks]
        .filter((task) => {
          const query = searchQuery.trim().toLowerCase()
          const matchesSearch =
            query.length === 0 ||
            task.title.toLowerCase().includes(query) ||
            task.description?.toLowerCase().includes(query)

          const matchesAssignee = assigneeFilter === 'ALL' || task.assigneeId === assigneeFilter
          const matchesPriority = priorityFilter === 'ALL' || task.priority === priorityFilter

          return matchesSearch && matchesAssignee && matchesPriority
        })
        .sort((left, right) => {
          if (sortOption === 'updated-asc') {
            return new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime()
          }

          if (sortOption === 'updated-desc') {
            return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
          }

          if (sortOption === 'priority-desc') {
            const order = { HIGH: 0, MEDIUM: 1, LOW: 2 }
            return (order[left.priority as keyof typeof order] ?? 99) - (order[right.priority as keyof typeof order] ?? 99)
          }

          if (sortOption === 'priority-asc') {
            const order = { LOW: 0, MEDIUM: 1, HIGH: 2 }
            return (order[left.priority as keyof typeof order] ?? 99) - (order[right.priority as keyof typeof order] ?? 99)
          }

          return left.title.localeCompare(right.title)
        })
        .reduce<Record<TaskStatus, BoardTask[]>>(
          (grouped, task) => {
            if (isTaskStatus(task.status)) {
              grouped[task.status].push(task)
            }
            return grouped
          },
          { TODO: [], IN_PROGRESS: [], DONE: [] }
        ),
    [assigneeFilter, priorityFilter, searchQuery, sortOption, tasks]
  )

  const totalTasks = tasks.length
  const visibleTaskCount = tasksByStatus.TODO.length + tasksByStatus.IN_PROGRESS.length + tasksByStatus.DONE.length
  const activeFilterCount = Number(searchQuery.trim().length > 0) + Number(assigneeFilter !== 'ALL') + Number(priorityFilter !== 'ALL')

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
      if (COLUMNS.some((column) => column.id === overId)) {
        newStatus = overId as TaskStatus
      } else {
        const overTask = tasks.find((task) => task.id === overId)
        if (overTask) newStatus = overTask.status as TaskStatus
      }

      if (!newStatus) return

      const task = tasks.find((currentTask) => currentTask.id === taskId)
      if (!task || task.status === newStatus) return

      setTasks((previous) =>
        previous.map((currentTask) =>
          currentTask.id === taskId ? { ...currentTask, status: newStatus } : currentTask
        )
      )

      try {
        await moveTask(taskId, newStatus)
      } catch (error) {
        console.error('Failed to move task:', error)
        setTasks((previous) => previous.map((currentTask) => (currentTask.id === taskId ? { ...currentTask, status: task.status } : currentTask)))
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
    setTasks((previous) => upsertTask(previous, updatedTask))
  }, [])

  const handleTaskDelete = useCallback((taskId: string) => {
    setTasks((previous) => previous.filter((task) => task.id !== taskId))
  }, [])

  const handleTaskCreate = useCallback((newTask: BoardTask) => {
    setTasks((previous) => upsertTask(previous, newTask))
  }, [])

  const clearFilters = useCallback(() => {
    setSearchQuery('')
    setAssigneeFilter('ALL')
    setPriorityFilter('ALL')
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

      <div className="flex h-full flex-col overflow-hidden" aria-live="polite">
        {(currentProjectName || currentProjectDescription) && (
          <header className="flex items-center justify-between border-b border-gray-200 bg-white px-3 py-2 sm:px-4">
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-gray-900">{currentProjectName}</h1>
              {currentProjectDescription && <p className="line-clamp-1 text-xs text-gray-500">{currentProjectDescription}</p>}
            </div>
            <button
              type="button"
              onClick={() => setShowProjectSettings(true)}
              className="ml-2 flex-shrink-0 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
              aria-label="Project settings"
            >
              Edit project
            </button>
          </header>
        )}
        <div className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 px-3 py-2 backdrop-blur sm:px-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFilters((value) => !value)}
              className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
            </button>
            <button
              type="button"
              onClick={() => setShowSort((value) => !value)}
              className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Sort
            </button>
            <button
              type="button"
              onClick={() => setShowMembers(true)}
              className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Members ({members.length})
            </button>
            <button
              type="button"
              onClick={() => setShowProjectSettings(true)}
              className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Settings
            </button>

            <div className="relative ml-auto w-full min-w-[180px] max-w-xs sm:w-auto sm:flex-1">
              <svg className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M12.9 14.32A8 8 0 1114.32 12.9l3.39 3.39a1 1 0 01-1.42 1.42l-3.39-3.39ZM14 8a6 6 0 11-12 0 6 6 0 0112 0Z" clipRule="evenodd" />
              </svg>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
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
                `${visibleTaskCount}/${totalTasks} tasks`
              )}
            </div>
          </div>

          {(showFilters || showSort) && (
            <div className="mt-2 flex flex-wrap items-end gap-2 border-t border-gray-200 pt-2">
              {showFilters && (
                <>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Assignee</label>
                    <select
                      value={assigneeFilter}
                      onChange={(event) => setAssigneeFilter(event.target.value)}
                      className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="ALL">All assignees</option>
                      {assignableUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Priority</label>
                    <select
                      value={priorityFilter}
                      onChange={(event) => setPriorityFilter(event.target.value)}
                      className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="ALL">All priorities</option>
                      <option value="HIGH">High</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="LOW">Low</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    Clear filters
                  </button>
                </>
              )}

              {showSort && (
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Sort by</label>
                  <select
                    value={sortOption}
                    onChange={(event) => setSortOption(event.target.value as SortOption)}
                    className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="updated-desc">Recently updated</option>
                    <option value="updated-asc">Oldest updated</option>
                    <option value="priority-desc">Priority: high to low</option>
                    <option value="priority-asc">Priority: low to high</option>
                    <option value="title-asc">Title: A to Z</option>
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="h-full overflow-x-auto">
          <div className="flex min-w-max gap-3 px-3 py-3 sm:gap-4 sm:px-4 sm:py-4">
            {COLUMNS.map((column) => (
              <Column
                key={column.id}
                id={column.id}
                label={column.label}
                color={column.color}
                tasks={tasksByStatus[column.id]}
                users={assignableUsers}
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
            <TaskCard task={activeTask} users={assignableUsers} onUpdate={handleTaskUpdate} onDelete={handleTaskDelete} isDragging />
          </div>
        )}
      </DragOverlay>

      {showMembers && (
        <ProjectMembersModal
          projectId={projectId}
          allUsers={users}
          members={members}
          onClose={() => setShowMembers(false)}
          onSave={setMembers}
        />
      )}

      {showProjectSettings && (
        <ProjectSettingsModal
          projectId={projectId}
          projectName={currentProjectName}
          projectDescription={currentProjectDescription}
          onClose={() => setShowProjectSettings(false)}
          onUpdate={(name, description) => {
            setCurrentProjectName(name)
            setCurrentProjectDescription(description)
          }}
        />
      )}
    </DndContext>
  )
}
