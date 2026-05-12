import type { Metadata } from 'next'
import './globals.css'
import AppShell from '@/components/layout/AppShell'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = {
  title: 'EvolvNex Jira',
  description: 'Internal project management dashboard',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [projects, users] = await Promise.all([
    prisma.project.findMany({
      select: {
        id: true,
        name: true,
        board: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    }),
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: {
        name: 'asc',
      },
    }),
  ])

  return (
    <html lang="en">
      <body style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <AppShell
          projects={projects.map((project) => ({
            id: project.id,
            name: project.name,
            boardId: project.board?.id ?? null,
          }))}
          users={users}
        >
          {children}
        </AppShell>
      </body>
    </html>
  )
}
