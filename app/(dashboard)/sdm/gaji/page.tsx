import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { GajiClient } from './_components/gaji-client'

export default async function GajiPage({
  searchParams: searchParamsRaw,
}: {
  searchParams: Promise<{ unitId?: string; month?: string }>
}) {
  const searchParams = await searchParamsRaw
  const session = await getSession()
  if (!session) redirect('/login')
  if (!['OWNER', 'MANAGER'].includes(session.user.role)) redirect('/dashboard')

  const units = await prisma.businessUnit.findMany({
    where: { isActive: true, tenantId: session.user.tenantId },
    select: { id: true, name: true, type: true },
    orderBy: { name: 'asc' },
  })

  const initialUnitId = units.some((u) => u.id === searchParams.unitId) ? searchParams.unitId! : undefined
  const initialMonth = searchParams.month && /^\d{4}-\d{2}$/.test(searchParams.month) ? searchParams.month : undefined

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Gaji Karyawan</h1>
        <p className="text-xs md:text-sm text-gray-500 mt-0.5">Gaji pokok, insentif/bonus/tunjangan, dan potongan per karyawan tiap bulan</p>
      </div>

      <GajiClient units={units} role={session.user.role} initialUnitId={initialUnitId} initialMonth={initialMonth} />
    </div>
  )
}
