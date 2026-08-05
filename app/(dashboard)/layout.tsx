import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Providers } from '@/components/providers'
import { DashboardShell } from '@/components/dashboard-shell'
import { getSiteName } from '@/lib/settings'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const siteName = await getSiteName()

  return (
    <Providers>
      <DashboardShell user={session.user} siteName={siteName}>
        {children}
      </DashboardShell>
    </Providers>
  )
}
