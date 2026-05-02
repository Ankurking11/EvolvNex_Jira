# EvolvNex Jira — Internal Dashboard

A production-ready Jira-like project management dashboard built with Next.js, Prisma, and dnd-kit.

## Features

- **Projects Dashboard** — View all projects with task counts
- **Kanban Board** — Drag-and-drop tasks between To Do, In Progress, and Done columns
- **Task Management** — Create, edit, delete tasks with title, description, status, priority, and assignee
- **Real-time Updates** — 5-second polling keeps the board in sync
- **SQLite Database** — Lightweight local database via Prisma ORM

## Tech Stack

- [Next.js 16](https://nextjs.org) — App Router, Server Actions, TypeScript
- [Tailwind CSS v4](https://tailwindcss.com) — Utility-first styling
- [Prisma v5](https://prisma.io) — ORM with SQLite
- [dnd-kit](https://dndkit.com) — Accessible drag-and-drop

## Getting Started

```bash
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the dashboard.

## Project Structure

```
app/
  dashboard/        # Projects listing page
  project/[id]/     # Kanban board for a project
  api/board/        # Polling endpoint
components/
  board/            # BoardClient, Column
  task/             # TaskCard, TaskModal
  ui/               # ProjectCard, CreateProjectButton
lib/
  actions.ts        # Server Actions (CRUD)
  prisma.ts         # Prisma client singleton
prisma/
  schema.prisma     # Database schema
  seed.ts           # Sample data
```
