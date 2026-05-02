'use server'

import { prisma } from './prisma'
import { revalidatePath } from 'next/cache'

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE'
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH'

export async function getBoardData(projectId: string) {
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
}

export async function getProjects() {
  return prisma.project.findMany({
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
}

export async function getUsers() {
  return prisma.user.findMany({ orderBy: { name: 'asc' } })
}

export async function createTask(data: {
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  assigneeId?: string
  boardId: string
}) {
  const task = await prisma.task.create({
    data,
    include: { assignee: true },
  })
  revalidatePath('/')
  return task
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
  const task = await prisma.task.update({
    where: { id: taskId },
    data,
    include: { assignee: true },
  })
  revalidatePath('/')
  return task
}

export async function deleteTask(taskId: string) {
  await prisma.task.delete({ where: { id: taskId } })
  revalidatePath('/')
}

export async function moveTask(taskId: string, newStatus: TaskStatus) {
  const task = await prisma.task.update({
    where: { id: taskId },
    data: { status: newStatus },
    include: { assignee: true },
  })
  revalidatePath('/')
  return task
}

export async function createProject(data: { name: string; description?: string }) {
  const project = await prisma.project.create({
    data: {
      ...data,
      board: { create: {} },
    },
  })
  revalidatePath('/')
  return project
}
