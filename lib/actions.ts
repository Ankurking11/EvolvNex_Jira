'use server'

import { prisma } from './prisma'
import { revalidatePath } from 'next/cache'

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE'
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH'

export async function getBoardData(projectId: string) {
  try {
    const board = await prisma.board.findFirst({
      where: { projectId },
      include: {
        tasks: {
          include: {
            assignee: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    return board
  } catch (error) {
    console.error('[getBoardData] Failed to fetch board for project', projectId, error)
    throw error
  }
}

export async function getProjects() {
  try {
    return await prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        board: {
          include: {
            _count: {
              select: { tasks: true },
            },
          },
        },
      },
    })
  } catch (error) {
    console.error('[getProjects] Failed to fetch projects', error)
    throw error
  }
}

export async function getUsers() {
  try {
    return await prisma.user.findMany({ orderBy: { name: 'asc' } })
  } catch (error) {
    console.error('[getUsers] Failed to fetch users', error)
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
      include: { assignee: true },
    })
    revalidatePath('/')
    return task
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
      include: { assignee: true },
    })
    revalidatePath('/')
    return task
  } catch (error) {
    console.error('[updateTask] Failed to update task', { taskId }, error)
    throw error
  }
}

export async function deleteTask(taskId: string) {
  try {
    await prisma.task.delete({ where: { id: taskId } })
    revalidatePath('/')
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
      include: { assignee: true },
    })
    revalidatePath('/')
    return task
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
    revalidatePath('/')
    return project
  } catch (error) {
    console.error('[createProject] Failed to create project', { name: data.name }, error)
    throw error
  }
}
