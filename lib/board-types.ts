export type BoardUser = {
  id: string
  name: string
  email: string
}

export type BoardTask = {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  assigneeId: string | null
  assignee: BoardUser | null
  commentCount: number
  boardId: string
  dueDate: string | Date | null
  createdAt: string | Date
  updatedAt: string | Date
}

export type BoardComment = {
  id: string
  content: string
  taskId: string
  authorId: string | null
  author: BoardUser | null
  createdAt: string | Date
}

export type BoardData = {
  id: string
  tasks: BoardTask[]
  members: BoardUser[]
}

export type AppProjectTask = {
  id: string
  title: string
  status: string
  priority: string
  updatedAt: string | Date
  assigneeId: string | null
  assignee: BoardUser | null
  _count: {
    comments: number
  }
}

export type AppProject = {
  id: string
  name: string
  description: string | null
  createdAt: string | Date
  updatedAt: string | Date
  members: Array<{
    userId: string
  }>
  board: {
    id: string
    _count: {
      tasks: number
    }
    tasks: AppProjectTask[]
  } | null
}
