import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getSiteName } from '@/lib/settings'
import { PengaturanClient } from './_components/pengaturan-client'

export default async function PengaturanPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.user.role !== 'OWNER') redirect('/dashboard')

  const [siteName, units] = await Promise.all([
    getSiteName(),
    prisma.businessUnit.findMany({
      where: { tenantId: session.user.tenantId },
      select: { id: true, name: true, type: true, location: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Pengaturan</h1>
        <p className="text-xs md:text-sm text-gray-500 mt-0.5">Nama aplikasi, nama unit bisnis, dan alamat — khusus Owner</p>
      </div>

      <PengaturanClient siteName={siteName} units={units} />
    </div>
  )
}
