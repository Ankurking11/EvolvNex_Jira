'use server'

import { prisma } from './prisma'
import { revalidatePath } from 'next/cache'
import { AppProject, BoardComment, BoardTask, BoardUser } from './board-types'

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE'
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH'

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

function serializeProject(project: {
  id: string
  name: string
  description: string | null
  createdAt: Date
  updatedAt: Date
  members: Array<{
    userId: string
  }>
  board: {
    id: string
    _count: {
      tasks: number
    }
    tasks: Array<{
      id: string
      title: string
      status: string
      priority: string
      updatedAt: Date
      assigneeId: string | null
      assignee: BoardUser | null
      _count: {
        comments: number
      }
    }>
  } | null
}): AppProject {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    members: project.members.map((member) => ({
      userId: member.userId,
    })),
    board: project.board
      ? {
          id: project.board.id,
          _count: project.board._count,
          tasks: project.board.tasks.map((task) => ({
            id: task.id,
            title: task.title,
            status: task.status,
            priority: task.priority,
            updatedAt: task.updatedAt.toISOString(),
            assigneeId: task.assigneeId,
            assignee: task.assignee,
            _count: task._count,
          })),
        }
      : null,
  }
}

async function hasCommentsTable() {
  try {
    const result = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT to_regclass('public.comments') IS NOT NULL AS "exists"
    `

    return result[0]?.exists ?? false
  } catch (error) {
    console.warn('[hasCommentsTable] Failed to inspect comments table availability', error)
    return false
  }
}

/**
 * Keeps layout, dashboard, and board views aligned after task and project mutations.
 */
function revalidateWorkspace(projectId?: string) {
  revalidatePath('/', 'layout')
  revalidatePath('/dashboard')
  if (projectId) {
    revalidatePath(`/project/${projectId}`)
  }
}

export async function getBoardData(projectId: string) {
  try {
    const commentsAvailable = await hasCommentsTable()
    const board = await prisma.board.findFirst({
      where: { projectId },
      include: {
        project: {
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
        },
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

    console.debug('[getBoardData] Loaded board data', {
      projectId,
      boardId: board.id,
      taskIds: board.tasks.map((task) => task.id),
      taskCount: board.tasks.length,
      memberIds: board.project.members.map((member) => member.userId),
      memberCount: board.project.members.length,
    })

    return {
      id: board.id,
      tasks: board.tasks.map(serializeTask),
      members: board.project.members.map((member) => member.user),
    }
  } catch (error) {
    console.error('[getBoardData] Failed to fetch board for project', projectId, error)
    return null
  }
}

export async function getProjects() {
  try {
    const commentsAvailable = await hasCommentsTable()
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        members: {
          include: {
            user: true,
          },
        },
        board: {
          include: {
            _count: {
              select: { tasks: true },
            },
            tasks: {
              select: {
                id: true,
                title: true,
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

    const normalizedProjects = projects.map((project) =>
      serializeProject({
        ...project,
        description: project.description ?? null,
        board: project.board
          ? {
              ...project.board,
              tasks: project.board.tasks.map((task) => ({
                ...task,
                _count: commentsAvailable
                  ? task._count
                  : {
                      comments: 0,
                    },
              })),
            }
          : project.board,
      })
    )

    console.debug('[getProjects] Loaded projects', {
      projectIds: normalizedProjects.map((project) => project.id),
      projectCount: normalizedProjects.length,
      boardIds: normalizedProjects.map((project) => project.board?.id ?? null),
    })

    return normalizedProjects
  } catch (error) {
    console.error('[getProjects] Failed to fetch projects', error)
    return []
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

async function ensureProjectMember(projectId: string, userId: string) {
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
}

export async function updateProjectMembers(projectId: string, userIds: string[]) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)))

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

    revalidateWorkspace(projectId)

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
    if (!(await hasCommentsTable())) {
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
    if (!(await hasCommentsTable())) {
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

    await ensureProjectMember(comment.task.board.projectId, data.authorId)
    revalidateWorkspace(comment.task.board.projectId)

    return serializeComment({
      ...comment,
      taskId: comment.taskId,
      authorId: comment.authorId,
    })
  } catch (error) {
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
    const task = await prisma.task.create({
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
      await ensureProjectMember(task.board.projectId, data.assigneeId)
    }
    revalidateWorkspace(task.board.projectId)
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
      await ensureProjectMember(task.board.projectId, task.assigneeId)
    }
    revalidateWorkspace(task.board.projectId)
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

    revalidateWorkspace(deletedTask.board.projectId)
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
    revalidateWorkspace(task.board.projectId)
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
    const serializedProject = serializeProject({
      ...project,
      description: project.description ?? null,
      members: [],
      board: project.board
        ? {
            id: project.board.id,
            _count: {
              tasks: 0,
            },
            tasks: [],
          }
        : null,
    })

    console.debug('[createProject] Created project successfully', {
      projectId: serializedProject.id,
      projectName: serializedProject.name,
      boardId: serializedProject.board?.id ?? null,
    })

    revalidateWorkspace(project.id)
    return serializedProject
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
    revalidateWorkspace(projectId)
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
    revalidateWorkspace(projectId)
  } catch (error) {
    console.error('[deleteProject] Failed to delete project', { projectId }, error)
    throw error
  }
}
