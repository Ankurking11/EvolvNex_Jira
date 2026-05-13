'use server'

import { prisma } from './prisma'
import { revalidatePath, unstable_cache, revalidateTag } from 'next/cache'
import { BoardComment, BoardTask, BoardUser } from './board-types'

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
 * Keeps dashboard aggregate cards and the project board page in sync after task mutations.
 */
function revalidateProjectAndDashboard(projectId: string) {
  revalidatePath('/dashboard')
  revalidatePath(`/project/${projectId}`)
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
  console.log('[DEBUG] getProjects called')
  const fetchProjects = async () => {
    console.log('[DEBUG] fetchProjects starting')
    const commentsAvailable = await hasCommentsTable()
    console.log('[DEBUG] commentsAvailable:', commentsAvailable)
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
                // ...(commentsAvailable
                //   ? {
                //       _count: {
                //         select: {
                //           comments: true,
                //         },
                //       },
                //     }
                //   : {}),
              },
            },
          },
        },
      },
    })
    console.log('[DEBUG] prisma.project.findMany returned:', projects.length, 'projects')

    // Always add _count to tasks for consistent typing
    const transformed = projects.map((project) => ({
      ...project,
      board: project.board
        ? {
            ...project.board,
            tasks: project.board.tasks.map((task) => ({
              ...task,
              _count: task._count || { comments: 0 },
            })),
          }
        : project.board,
    }))
    console.log('[DEBUG] returning transformed projects:', transformed.length)
    return transformed
  }

  try {
    // const result = await unstable_cache(fetchProjects, ['projects'])()
    const result = await fetchProjects()
    console.log('[DEBUG] getProjects returning:', result.length, 'projects')
    return result
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
    revalidateProjectAndDashboard(comment.task.board.projectId)

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
    revalidateTag('projects', {})
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
      await ensureProjectMember(task.board.projectId, task.assigneeId)
    }
    revalidateTag('projects', {})
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
    revalidateTag('projects', {})
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
    revalidateTag('projects', {})
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
    revalidateTag('projects', {})
    revalidatePath('/dashboard')
  } catch (error) {
    console.error('[deleteProject] Failed to delete project', { projectId }, error)
    throw error
  }
}
