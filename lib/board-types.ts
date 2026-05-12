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
  createdAt: string | Date
  updatedAt: string | Date
}

export type BoardComment = {
  id: string
  content: string
  taskId: string
  authorId: string
  author: BoardUser
  createdAt: string | Date
  updatedAt: string | Date
}

export type BoardData = {
  id: string
  tasks: BoardTask[]
  members: BoardUser[]
}
