'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { BoardUser } from '@/lib/board-types'
import GlobalCreateButton from '@/components/ui/GlobalCreateButton'

interface AppShellProps {
  children: ReactNode
  projects: Array<{
    id: string
    name: string
    boardId: string | null
  }>
  users: BoardUser[]
}

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard?view=projects', label: 'Projects' },
  { href: '/dashboard?view=my-tasks', label: 'My Tasks' },
  { href: '/dashboard?view=activity', label: 'Activity' },
  { href: '/dashboard?view=reports', label: 'Reports' },
  { href: '/dashboard?view=settings', label: 'Settings' },
]

function toTitleCase(value: string) {
  return value
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export default function AppShell({ children, projects, users }: AppShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const searchDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | number | null>(null)
  const currentView = searchParams.get('view') ?? 'dashboard'

  useEffect(() => {
    return () => {
      if (searchDebounceTimerRef.current) {
        window.clearTimeout(searchDebounceTimerRef.current)
      }
    }
  }, [])

  const breadcrumbs = useMemo(() => {
    const segments = pathname.split('/').filter(Boolean)
    if (segments.length === 0) return ['Home']

    const extraView = pathname === '/dashboard' && currentView !== 'dashboard' ? [toTitleCase(currentView)] : []
    return ['Home', ...segments.map(toTitleCase), ...extraView]
  }, [currentView, pathname])

  return (
    <div className="relative z-0 flex h-screen bg-[#f5f7fb] text-gray-900">
      <aside
        className={`fixed inset-y-0 left-0 z-20 flex w-64 flex-col border-r border-gray-200 bg-white transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${sidebarOpen ? 'lg:w-64' : 'lg:w-16'}`}
      >
        <div className="flex h-14 items-center justify-between border-b border-gray-200 px-3">
          <div className={`flex items-center gap-2 overflow-hidden ${sidebarOpen ? 'opacity-100' : 'lg:opacity-0'}`}>
            <span className="grid h-7 w-7 place-items-center rounded bg-blue-600 text-xs font-bold text-white">E</span>
            <span className="whitespace-nowrap text-sm font-semibold">EvolvNex Jira</span>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen((value) => !value)}
            className="hidden rounded p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 lg:block"
            aria-label="Toggle sidebar"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          {NAV_ITEMS.map((item) => {
            const isActive =
              (item.label === 'Dashboard' && pathname === '/dashboard' && currentView === 'dashboard') ||
              (item.label === 'Projects' && (pathname.startsWith('/project') || currentView === 'projects')) ||
              (item.label === 'My Tasks' && currentView === 'my-tasks') ||
              (item.label === 'Activity' && currentView === 'activity') ||
              (item.label === 'Reports' && currentView === 'reports') ||
              (item.label === 'Settings' && currentView === 'settings')

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileSidebarOpen(false)}
                className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium transition ${
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
                title={item.label}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                <span className={`${sidebarOpen ? '' : 'lg:hidden'}`}>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>

      {mobileSidebarOpen && (
        <button
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 px-3 py-2 backdrop-blur sm:px-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="rounded p-1 text-gray-600 transition hover:bg-gray-100 lg:hidden"
              aria-label="Open sidebar"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900">{breadcrumbs[breadcrumbs.length - 1]}</p>
              <p className="truncate text-xs text-gray-500">{breadcrumbs.join(' / ')}</p>
            </div>

            <div className="relative hidden min-w-[220px] max-w-sm md:block">
              <svg className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M12.9 14.32A8 8 0 1114.32 12.9l3.39 3.39a1 1 0 01-1.42 1.42l-3.39-3.39ZM14 8a6 6 0 11-12 0 6 6 0 0112 0Z" clipRule="evenodd" />
              </svg>
              <input
                type="search"
                defaultValue={searchParams.get('q') ?? ''}
                onChange={(event) => {
                  if (searchDebounceTimerRef.current) {
                    window.clearTimeout(searchDebounceTimerRef.current)
                  }

                  const nextValue = event.target.value
                  searchDebounceTimerRef.current = window.setTimeout(() => {
                    const normalizedQuery = nextValue.trim()
                    const currentQuery = searchParams.get('q') ?? ''
                    if (normalizedQuery === currentQuery) return

                    const nextSearchParams = new URLSearchParams(searchParams.toString())
                    if (normalizedQuery.length > 0) {
                      nextSearchParams.set('q', normalizedQuery)
                    } else {
                      nextSearchParams.delete('q')
                    }

                    const nextQuery = nextSearchParams.toString()
                    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname)
                  }, 250)
                }}
                placeholder="Search projects and tasks"
                className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-8 pr-2 text-xs text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <GlobalCreateButton
              projects={projects}
              users={users}
            />
            <button className="rounded p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700" aria-label="Notifications">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>
            <button className="grid h-8 w-8 place-items-center rounded-full bg-gray-200 text-xs font-semibold text-gray-700">U</button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  )
}
