import type { Metadata } from 'next'
import { Suspense } from 'react'
import './globals.css'
import AppShell from '@/components/layout/AppShell'
import { getProjects, getUsers } from '@/lib/actions'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'EvolvNex Jira',
  description: 'Internal project management dashboard',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [projects, users] = await Promise.all([getProjects(), getUsers()])

  return (
    <html lang="en">
      <body style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <Suspense
          fallback={
            <main className="min-h-screen" aria-live="polite" aria-busy="true">
              <span className="sr-only">Loading application</span>
            </main>
          }
        >
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
        </Suspense>
      </body>
    </html>
  )
}
