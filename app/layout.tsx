import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'EvolvNex Jira',
  description: 'Internal project management dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>{children}</body>
    </html>
  )
}
