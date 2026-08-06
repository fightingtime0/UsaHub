import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Providers } from '@/components/providers'
import { DashboardShell } from '@/components/dashboard-shell'
import { getSiteName } from '@/lib/settings'
import { prisma } from '@/lib/prisma'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const siteName = await getSiteName()

  // Unit aktif tenant ini — dipakai Sidebar untuk cuma menampilkan menu unit yang sungguh
  // dinyalakan (bukan asumsi 5 selalu ada), dan pakai nama asli unit sebagai label menu.
  const units = session.user.tenantId
    ? await prisma.businessUnit.findMany({
        where: { tenantId: session.user.tenantId, isActive: true },
        select: { type: true, name: true },
        orderBy: { name: 'asc' },
      })
    : []

  return (
    <Providers>
      <DashboardShell user={session.user} siteName={siteName} units={units}>
        {children}
      </DashboardShell>
    </Providers>
  )
}
