# EvolvNex Jira — Internal Dashboard

A production-ready Jira-like project management dashboard built with Next.js, Prisma, and dnd-kit.

## Features

- **Projects Dashboard** — View all projects with task counts
- **Kanban Board** — Drag-and-drop tasks between To Do, In Progress, and Done columns
- **Task Management** — Create, edit, delete tasks with title, description, status, priority, and assignee
- **Real-time Updates** — 5-second polling keeps the board in sync
- **PostgreSQL Database** — Production-grade database via Prisma ORM

## Tech Stack

- [Next.js 16](https://nextjs.org) — App Router, Server Actions, TypeScript
- [Tailwind CSS v4](https://tailwindcss.com) — Utility-first styling
- [Prisma v5](https://prisma.io) — ORM with PostgreSQL
- [dnd-kit](https://dndkit.com) — Accessible drag-and-drop

## Local Development

```bash
npm install
# copy and fill in your DATABASE_URL
cp .env.example .env.local
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the dashboard.

## Deploying to Vercel

### 1. Create a PostgreSQL database

Use [Neon](https://neon.tech) (free tier, recommended for Vercel) or any other PostgreSQL provider:

1. Sign up at neon.tech → create a new project
2. Copy the **connection string** (it looks like `postgresql://user:pass@host/db?sslmode=require`)

### 2. Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

1. Import this repository in the Vercel dashboard
2. Add the environment variable:
   - `DATABASE_URL` → your PostgreSQL connection string
3. Click **Deploy** — Vercel runs `prisma generate && next build` automatically

### 3. Run migrations after first deploy

Open the Vercel dashboard → your project → **Settings → Environment Variables**, confirm `DATABASE_URL` is set, then run from your local machine (pointing at the production DB):

```bash
DATABASE_URL="<your-production-connection-string>" npx prisma migrate deploy
DATABASE_URL="<your-production-connection-string>" npx prisma db seed
```

Or use the [Vercel CLI](https://vercel.com/docs/cli):

```bash
vercel env pull .env.production.local
npx prisma migrate deploy
npx prisma db seed
```

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

