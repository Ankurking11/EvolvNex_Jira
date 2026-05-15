'use server'

import { prisma } from './prisma'
import { revalidatePath, unstable_cache, revalidateTag, updateTag } from 'next/cache'
import { BoardComment, BoardTask, BoardUser } from './board-types'
import { Prisma } from '@prisma/client'

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE'
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH'
const TABLE_AVAILABILITY_TTL_MS = 5000

type TableAvailabilityCacheEntry = {
  value: boolean
  expiresAt: number
}

let commentsTableCache: TableAvailabilityCacheEntry | null = null
let projectMembersTableCache: TableAvailabilityCacheEntry | null = null

function readTableAvailabilityCache(entry: TableAvailabilityCacheEntry | null) {
  if (!entry) return null
  if (Date.now() >= entry.expiresAt) return null
  return entry.value
}

function writeTableAvailabilityCache(value: boolean): TableAvailabilityCacheEntry {
  return {
    value,
    expiresAt: Date.now() + TABLE_AVAILABILITY_TTL_MS,
  }
}

function serializeTask(task: {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  assigneeId: string | null
  assignee: BoardUser | null
  boardId: string
  dueDate: Date | null
  createdAt: Date
  updatedAt: Date
  _count?: { comments: number }
}): BoardTask {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    assigneeId: task.assigneeId,
    assignee: task.assignee,
    commentCount: task._count?.comments ?? 0,
    boardId: task.boardId,
    dueDate: task.dueDate,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  }
}

function serializeComment(comment: {
  id: string
  content: string
  taskId: string
  authorId: string | null
  author: BoardUser | null
  createdAt: Date
}): BoardComment {
  return {
    id: comment.id,
    content: comment.content,
    taskId: comment.taskId,
    authorId: comment.authorId,
    author: comment.author,
    createdAt: comment.createdAt,
  }
}

async function hasCommentsTable(options?: { forceRefresh?: boolean }) {
  if (!options?.forceRefresh) {
    const cached = readTableAvailabilityCache(commentsTableCache)
    if (cached !== null) {
      return cached
    }
  }

  try {
    const result = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT to_regclass('public.comments') IS NOT NULL AS "exists"
    `

    const exists = result[0]?.exists ?? false
    if (!exists) {
      await logCommentsTableDiagnostics('hasCommentsTable:not_found')
    }
    commentsTableCache = writeTableAvailabilityCache(exists)
    return exists
  } catch (error) {
    console.warn('[hasCommentsTable] Failed to inspect comments table availability', error)
    await logCommentsTableDiagnostics('hasCommentsTable:inspect_failed')
    commentsTableCache = writeTableAvailabilityCache(false)
    return false
  }
}

async function hasCommentsTableWithRetry() {
  if (await hasCommentsTable()) {
    return true
  }

  return hasCommentsTable({ forceRefresh: true })
}

async function hasProjectMembersTable() {
  const cached = readTableAvailabilityCache(projectMembersTableCache)
  if (cached !== null) {
    return cached
  }

  try {
    const result = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT to_regclass('public.project_members') IS NOT NULL AS "exists"
    `

    const exists = result[0]?.exists ?? false
    projectMembersTableCache = writeTableAvailabilityCache(exists)
    return exists
  } catch (error) {
    console.warn('[hasProjectMembersTable] Failed to inspect project_members table availability', error)
    projectMembersTableCache = writeTableAvailabilityCache(false)
    return false
  }
}

function isMissingProjectMembersTableError(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2021' &&
    typeof error.meta?.table === 'string' &&
    error.meta.table.includes('project_members')
  ) {
    return true
  }

  if (error instanceof Error) {
    return error.message.includes('public.project_members') || error.message.includes('project_members')
  }

  return false
}

function isMissingCommentsTableError(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2021' &&
    typeof error.meta?.table === 'string' &&
    error.meta.table.includes('comments')
  ) {
    return true
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return (
      message.includes('public.comments') ||
      message.includes('relation "comments"') ||
      message.includes("table 'comments'") ||
      message.includes('table `comments`')
    )
  }

  return false
}

async function logCommentsTableDiagnostics(diagnosticSource: string) {
  try {
    const [tableRows, columnRows, fkRows] = await Promise.all([
      prisma.$queryRaw<Array<{ table_schema: string; table_name: string }>>`
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'comments'
      `,
      prisma.$queryRaw<
        Array<{ column_name: string; data_type: string; udt_name: string; is_nullable: string; column_default: string | null }>
      >`
        SELECT column_name, data_type, udt_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'comments'
        ORDER BY ordinal_position
      `,
      prisma.$queryRaw<Array<{ conname: string; definition: string }>>`
        SELECT c.conname, pg_get_constraintdef(c.oid) AS definition
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public' AND t.relname = 'comments' AND c.contype = 'f'
        ORDER BY c.conname
      `,
    ])

    console.error('[comments-schema-diagnostics]', {
      diagnosticSource,
      tableExists: tableRows.length > 0,
      columns: columnRows,
      foreignKeys: fkRows,
    })
  } catch (diagnosticError) {
    console.error('[comments-schema-diagnostics] failed', { diagnosticSource }, diagnosticError)
  }
}

/**
 * Keeps dashboard aggregate cards and the project board page in sync after task mutations.
 */
function revalidateProjectAndDashboard(projectId: string) {
  revalidatePath('/dashboard')
  revalidatePath(`/project/${projectId}`)
}

export async function getBoardData(projectId: string) {
  try {
    const commentsAvailable = await hasCommentsTable()
    const projectMembersAvailable = await hasProjectMembersTable()
    const board = await prisma.board.findFirst({
      where: { projectId },
      include: {
        project: projectMembersAvailable
          ? {
              include: {
                members: {
                  include: {
                    user: true,
                  },
                  orderBy: {
                    user: {
                      name: 'asc',
                    },
                  },
                },
              },
            }
          : true,
        tasks: {
          include: {
            assignee: true,
            ...(commentsAvailable
              ? {
                  _count: {
                    select: {
                      comments: true,
                    },
                  },
                }
              : {}),
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    if (!board) return null

    return {
      id: board.id,
      tasks: board.tasks.map(serializeTask),
      members: projectMembersAvailable
        ? ((board.project as { members?: Array<{ user: BoardUser }> }).members ?? []).map((member) => member.user)
        : [],
    }
  } catch (error) {
    console.error('[getBoardData] Failed to fetch board for project', projectId, error)
    return null
  }
}

export async function getProjects() {
  const fetchProjects = async () => {
    const commentsAvailable = await hasCommentsTable()
    const projectMembersAvailable = await hasProjectMembersTable()
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        ...(projectMembersAvailable
          ? {
              members: {
                include: {
                  user: true,
                },
              },
            }
          : {}),
        board: {
          include: {
            _count: {
              select: { tasks: true },
            },
            tasks: {
              select: {
                id: true,
                title: true,
                description: true,
                status: true,
                priority: true,
                updatedAt: true,
                assigneeId: true,
                assignee: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
                ...(commentsAvailable
                  ? {
                      _count: {
                        select: {
                          comments: true,
                        },
                      },
                    }
                  : {}),
              },
            },
          },
        },
      },
    })

    // Always add _count to tasks for consistent typing
    const transformed = projects.map((project) => ({
      ...project,
      members: projectMembersAvailable
        ? (project as { members?: Array<{ userId: string }> }).members ?? []
        : [],
      board: project.board
        ? {
            ...project.board,
            tasks: project.board.tasks.map((task) => ({
              ...task,
              _count: {
                comments: (task as { _count?: { comments?: number } })._count?.comments ?? 0,
              },
            })),
          }
        : project.board,
    }))
    return transformed
  }

  try {
    return await unstable_cache(fetchProjects, ['projects'], {
      revalidate: 30,
      tags: ['projects'],
    })()
  } catch (error) {
    console.error('[getProjects] Failed to fetch projects with members, trying without members', error)
    // Fallback: fetch without members relation
    try {
      const projects = await prisma.project.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          board: {
            include: {
              _count: {
                select: { tasks: true },
              },
              tasks: {
                select: {
                  id: true,
                  title: true,
                  description: true,
                  status: true,
                  priority: true,
                  updatedAt: true,
                  assigneeId: true,
                assignee: {
                  select: {
                    id: true,
                      name: true,
                    email: true,
                  },
                },
              },
            },
          },
          },
        },
      })

      // Add empty members array for compatibility
      const transformed = projects.map((project) => ({
        ...project,
        members: [],
        board: project.board
          ? {
              ...project.board,
              tasks: project.board.tasks.map((task) => ({
                ...task,
              })),
            }
          : project.board,
      }))
      return transformed
    } catch (fallbackError) {
      console.error('[getProjects] Fallback also failed', fallbackError)
      return []
    }
  }
}

export async function getUsers() {
  try {
    return await prisma.user.findMany({ orderBy: { name: 'asc' } })
  } catch (error) {
    console.error('[getUsers] Failed to fetch users', error)
    return []
  }
}

export async function createUser(data: { name: string; email: string; role?: string }) {
  const name = data.name.trim()
  const email = data.email.trim().toLowerCase()
  const normalizedRole = (data.role?.trim().toUpperCase() || 'MEMBER') as 'MEMBER' | 'ADMIN'
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (!name) {
    throw new Error('Name is required')
  }

  if (!email) {
    throw new Error('Email is required')
  }

  if (!emailPattern.test(email)) {
    throw new Error('Please enter a valid email address')
  }

  if (normalizedRole !== 'MEMBER' && normalizedRole !== 'ADMIN') {
    throw new Error('Invalid role')
  }

  try {
    const user = await prisma.user.create({
      data: {
        name,
        email,
        role: normalizedRole,
      },
    })

    revalidateTag('projects', 'max')
    revalidatePath('/dashboard')
    revalidatePath('/', 'layout')

    return user
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new Error('A user with this email already exists')
    }
    console.error('[createUser] Failed to create user', { email }, error)
    throw error
  }
}

export async function deleteUser(userId: string) {
  const id = userId.trim()
  if (!id) {
    throw new Error('User id is required')
  }

  const commentsAvailable = await hasCommentsTable()
  const projectMembersAvailable = await hasProjectMembersTable()

  try {
    await prisma.$transaction(async (tx) => {
      await tx.task.updateMany({
        where: { assigneeId: id },
        data: { assigneeId: null },
      })

      if (commentsAvailable) {
        await tx.comment.updateMany({
          where: { authorId: id },
          data: { authorId: null },
        })
      }

      if (projectMembersAvailable) {
        await tx.projectMember.deleteMany({
          where: { userId: id },
        })
      }

      await tx.user.delete({
        where: { id },
      })
    })

    revalidateTag('projects', 'max')
    revalidatePath('/dashboard')
    revalidatePath('/', 'layout')
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new Error('User not found')
    }
    console.error('[deleteUser] Failed to delete user', { userId: id }, error)
    throw error
  }
}

async function ensureProjectMember(projectId: string, userId: string) {
  try {
    await prisma.projectMember.upsert({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
      update: {},
      create: {
        projectId,
        userId,
      },
    })
  } catch (error) {
    if (isMissingProjectMembersTableError(error)) {
      console.warn('[ensureProjectMember] project_members table is unavailable; skipping member sync')
      return
    }
    throw error
  }
}

async function tryEnsureProjectMember(projectId: string, userId: string, source: string) {
  try {
    await ensureProjectMember(projectId, userId)
  } catch (error) {
    console.warn(`[${source}] Failed to sync project membership`, { projectId, userId }, error)
  }
}

export async function updateProjectMembers(projectId: string, userIds: string[]) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)))
  if (!(await hasProjectMembersTable())) {
    return []
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (uniqueUserIds.length === 0) {
        await tx.projectMember.deleteMany({
          where: { projectId },
        })
      } else {
        await tx.projectMember.deleteMany({
          where: {
            projectId,
            userId: {
              notIn: uniqueUserIds,
            },
          },
        })
      }

      for (const userId of uniqueUserIds) {
        await tx.projectMember.upsert({
          where: {
            projectId_userId: {
              projectId,
              userId,
            },
          },
          update: {},
          create: {
            projectId,
            userId,
          },
        })
      }
    })

    revalidateProjectAndDashboard(projectId)

    const members = await prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: true,
      },
      orderBy: {
        user: {
          name: 'asc',
        },
      },
    })

    return members.map((member) => member.user)
  } catch (error) {
    console.error('[updateProjectMembers] Failed to update project members', { projectId }, error)
    throw error
  }
}

export async function getTaskComments(taskId: string) {
  try {
    if (!(await hasCommentsTableWithRetry())) {
      return []
    }

    const comments = await prisma.comment.findMany({
      where: { taskId },
      include: {
        author: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    return comments.map(serializeComment)
  } catch (error) {
    console.error('[getTaskComments] Failed to fetch comments', { taskId }, error)
    return []
  }
}

export async function createTaskComment(data: { taskId: string; authorId: string; content: string }) {
  const content = data.content.trim()
  if (!content) {
    throw new Error('Comment content is required')
  }

  try {
    if (!(await hasCommentsTableWithRetry())) {
      await logCommentsTableDiagnostics('createTaskComment:preflight_false')
      throw new Error('Comments are unavailable until the comments migration is applied.')
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        taskId: data.taskId,
        authorId: data.authorId,
      },
      include: {
        author: true,
        task: {
          include: {
            board: {
              select: {
                projectId: true,
              },
            },
          },
        },
      },
    })

    await tryEnsureProjectMember(comment.task.board.projectId, data.authorId, 'createTaskComment')
    revalidateProjectAndDashboard(comment.task.board.projectId)

    return serializeComment({
      ...comment,
      taskId: comment.taskId,
      authorId: comment.authorId,
    })
  } catch (error) {
    if (isMissingCommentsTableError(error)) {
      commentsTableCache = writeTableAvailabilityCache(false)
      throw new Error('Comments are unavailable until the comments migration is applied.')
    }
    console.error('[createTaskComment] Failed to create comment', { taskId: data.taskId }, error)
    throw error
  }
}

export async function createTask(data: {
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  assigneeId?: string
  boardId: string
  dueDate?: string | null
}) {
  try {
    const commentsAvailable = await hasCommentsTable()
    const task = await prisma.$transaction(async (tx) => {
      const createdTask = await tx.task.create({
        data: {
          title: data.title,
          description: data.description,
          status: data.status,
          priority: data.priority,
          assigneeId: data.assigneeId,
          boardId: data.boardId,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
        },
        include: {
          assignee: true,
          board: {
            select: { projectId: true },
          },
          ...(commentsAvailable
            ? {
                _count: {
                  select: {
                    comments: true,
                  },
                },
              }
            : {}),
        },
      })

      if (data.assigneeId) {
        try {
          await tx.projectMember.upsert({
            where: {
              projectId_userId: {
                projectId: createdTask.board.projectId,
                userId: data.assigneeId,
              },
            },
            update: {},
            create: {
              projectId: createdTask.board.projectId,
              userId: data.assigneeId,
            },
          })
        } catch (error) {
          if (!isMissingProjectMembersTableError(error)) {
            throw error
          }
        }
      }

      return createdTask
    })

    revalidateTag('projects', 'max')
    revalidateProjectAndDashboard(task.board.projectId)
    return serializeTask(task)
  } catch (error) {
    console.error('[createTask] Failed to create task', { boardId: data.boardId, title: data.title }, error)
    throw error
  }
}

export async function updateTask(
  taskId: string,
  data: {
    title?: string
    description?: string
    status?: TaskStatus
    priority?: TaskPriority
    assigneeId?: string | null
    dueDate?: string | null
  }
) {
  try {
    const commentsAvailable = await hasCommentsTable()
    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        assigneeId: data.assigneeId,
        ...(Object.prototype.hasOwnProperty.call(data, 'dueDate')
          ? { dueDate: data.dueDate ? new Date(data.dueDate) : null }
          : {}),
      },
      include: {
        assignee: true,
        board: {
          select: { projectId: true },
        },
        ...(commentsAvailable
          ? {
              _count: {
                select: {
                  comments: true,
                },
              },
            }
          : {}),
      },
    })
    if (task.assigneeId) {
      await tryEnsureProjectMember(task.board.projectId, task.assigneeId, 'updateTask')
    }
    revalidateTag('projects', 'max')
    revalidateProjectAndDashboard(task.board.projectId)
    return serializeTask(task)
  } catch (error) {
    console.error('[updateTask] Failed to update task', { taskId }, error)
    throw error
  }
}

export async function deleteTask(taskId: string) {
  try {
    const deletedTask = await prisma.task.delete({
      where: { id: taskId },
      include: {
        board: {
          select: { projectId: true },
        },
      },
    })

    revalidateProjectAndDashboard(deletedTask.board.projectId)
  } catch (error) {
    console.error('[deleteTask] Failed to delete task', { taskId }, error)
    throw error
  }
}

export async function moveTask(taskId: string, newStatus: TaskStatus) {
  try {
    const commentsAvailable = await hasCommentsTable()
    const task = await prisma.task.update({
      where: { id: taskId },
      data: { status: newStatus },
      include: {
        assignee: true,
        board: {
          select: { projectId: true },
        },
        ...(commentsAvailable
          ? {
              _count: {
                select: {
                  comments: true,
                },
              },
            }
          : {}),
      },
    })
    revalidateProjectAndDashboard(task.board.projectId)
    return serializeTask(task)
  } catch (error) {
    console.error('[moveTask] Failed to move task', { taskId, newStatus }, error)
    throw error
  }
}

export async function createProject(data: { name: string; description?: string }) {
  try {
    const project = await prisma.project.create({
      data: {
        ...data,
        board: { create: {} },
      },
      include: {
        board: {
          select: {
            id: true,
          },
        },
      },
    })
    updateTag('projects')
    revalidateProjectAndDashboard(project.id)
    return project
  } catch (error) {
    console.error('[createProject] Failed to create project', { name: data.name }, error)
    throw error
  }
}

export async function updateProject(projectId: string, data: { name?: string; description?: string | null }) {
  try {
    const project = await prisma.project.update({
      where: { id: projectId },
      data,
    })
    revalidateTag('projects', 'max')
    revalidateProjectAndDashboard(projectId)
    return project
  } catch (error) {
    console.error('[updateProject] Failed to update project', { projectId }, error)
    throw error
  }
}

export async function deleteProject(projectId: string) {
  try {
    await prisma.project.delete({
      where: { id: projectId },
    })
    revalidateTag('projects', 'max')
    revalidatePath('/dashboard')
  } catch (error) {
    console.error('[deleteProject] Failed to delete project', { projectId }, error)
    throw error
  }
}
