import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { SdmClient } from './_components/sdm-client'

export default async function SdmPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!['OWNER', 'MANAGER'].includes(session.user.role)) redirect('/dashboard')

  const [employees, units] = await Promise.all([
    prisma.employee.findMany({
      where: { isActive: true, primaryUnit: { tenantId: session.user.tenantId } },
      include: {
        primaryUnit: { select: { id: true, name: true, type: true } },
        user: { select: { email: true, role: true } },
      },
      orderBy: [{ primaryUnit: { name: 'asc' } }, { name: 'asc' }],
    }),
    prisma.businessUnit.findMany({
      where: { isActive: true, tenantId: session.user.tenantId },
      select: { id: true, name: true, type: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const serialized = employees.map((e) => ({
    ...e,
    salary:   e.salary ? Number(e.salary) : null,
    joinDate: e.joinDate ? e.joinDate.toISOString() : null,
    shifts:   [],
  }))

  const unitTypeCounts = units.map((u) => ({
    ...u,
    count: employees.filter((e) => e.primaryUnitId === u.id).length,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">SDM — Sumber Daya Manusia</h1>
        <p className="text-xs md:text-sm text-gray-500 mt-0.5">Manajemen karyawan semua unit bisnis</p>
      </div>

      {/* Unit summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {unitTypeCounts.map((u) => (
          <div key={u.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-3 md:px-5 py-3 md:py-4">
            <p className="text-xs text-gray-500 font-medium truncate">{u.name}</p>
            <p className="text-xl md:text-2xl font-bold text-gray-800 mt-1">{u.count}</p>
            <p className="text-xs text-gray-400">karyawan aktif</p>
          </div>
        ))}
      </div>

      <SdmClient
        employees={serialized}
        units={units}
        role={session.user.role}
      />
    </div>
  )
}


