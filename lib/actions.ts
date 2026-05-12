'use server'

import { prisma } from './prisma'
import { revalidatePath } from 'next/cache'
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
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  }
}

function serializeComment(comment: {
  id: string
  content: string
  taskId: string
  authorId: string
  author: BoardUser
  createdAt: Date
  updatedAt: Date
}): BoardComment {
  return {
    id: comment.id,
    content: comment.content,
    taskId: comment.taskId,
    authorId: comment.authorId,
    author: comment.author,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
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
    const board = await prisma.board.findFirst({
      where: { projectId },
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
        tasks: {
          include: {
            assignee: true,
            _count: {
              select: {
                comments: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    if (!board) return null

    return {
      id: board.id,
      tasks: board.tasks.map(serializeTask),
      members: board.members.map((member) => member.user),
    }
  } catch (error) {
    console.error('[getBoardData] Failed to fetch board for project', projectId, error)
    return null
  }
}

export async function getProjects() {
  try {
    return await prisma.project.findMany({
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
                _count: {
                  select: {
                    comments: true,
                  },
                },
              },
            },
          },
        },
      },
    })
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
}) {
  try {
    const task = await prisma.task.create({
      data,
      include: {
        assignee: true,
        board: {
          select: { projectId: true },
        },
        _count: {
          select: {
            comments: true,
          },
        },
      },
    })
    if (data.assigneeId) {
      await ensureProjectMember(task.board.projectId, data.assigneeId)
    }
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
  }
) {
  try {
    const task = await prisma.task.update({
      where: { id: taskId },
      data,
      include: {
        assignee: true,
        board: {
          select: { projectId: true },
        },
        _count: {
          select: {
            comments: true,
          },
        },
      },
    })
    if (task.assigneeId) {
      await ensureProjectMember(task.board.projectId, task.assigneeId)
    }
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
    const task = await prisma.task.update({
      where: { id: taskId },
      data: { status: newStatus },
      include: {
        assignee: true,
        board: {
          select: { projectId: true },
        },
        _count: {
          select: {
            comments: true,
          },
        },
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
    })
    revalidateProjectAndDashboard(project.id)
    return project
  } catch (error) {
    console.error('[createProject] Failed to create project', { name: data.name }, error)
    throw error
  }
}
