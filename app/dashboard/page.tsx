export const dynamic = 'force-dynamic'

import DashboardClient from '@/components/dashboard/DashboardClient'
import { getUsers } from '@/lib/actions'

type DashboardView = 'dashboard' | 'projects' | 'my-tasks' | 'activity' | 'reports' | 'settings'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const requestedView = resolvedSearchParams.view
  const view: DashboardView =
    requestedView === 'projects' ||
    requestedView === 'my-tasks' ||
    requestedView === 'activity' ||
    requestedView === 'reports' ||
    requestedView === 'settings'
      ? requestedView
      : 'dashboard'

  const users = await getUsers()

  return <DashboardClient users={users} view={view} />
}
