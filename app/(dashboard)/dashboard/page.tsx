import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import type { UnitType } from '@prisma/client'

const UNIT_META: Record<UnitType, { fallbackLabel: string; color: string; href: string }> = {
  RETAIL:     { fallbackLabel: 'Toko Retail', color: 'bg-blue-500',    href: '/toko' },
  HOMESTAY:   { fallbackLabel: 'Homestay',    color: 'bg-green-500',   href: '/homestay' },
  RESTAURANT: { fallbackLabel: 'Restoran',    color: 'bg-orange-500',  href: '/restoran' },
  LODGING:    { fallbackLabel: 'Penginapan',  color: 'bg-purple-500',  href: '/penginapan' },
  PERTASHOP:  { fallbackLabel: 'Pertashop',   color: 'bg-emerald-500', href: '/pertashop' },
}

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  // Non-OWNER langsung redirect ke modul mereka
  if (session.user.role !== 'OWNER') {
    const unitRedirect: Record<string, string> = {
      RETAIL:     '/toko',
      HOMESTAY:   '/homestay',
      RESTAURANT: '/restoran',
      LODGING:    '/penginapan',
      PERTASHOP:  '/pertashop',
    }
    const dest = session.user.primaryUnitType
      ? unitRedirect[session.user.primaryUnitType]
      : null
    if (dest) redirect(dest)
  }

  // Cuma tampilkan kartu untuk unit yang sungguh aktif buat tenant ini.
  const activeUnits = session.user.tenantId
    ? await prisma.businessUnit.findMany({
        where: { tenantId: session.user.tenantId, isActive: true },
        select: { type: true, name: true },
      })
    : []

  return (
    <div>
      <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">Selamat datang, {session.user.name}</h1>
      <p className="text-sm text-gray-500 mb-6">Ringkasan semua unit bisnis</p>

      {activeUnits.length === 0 ? (
        <p className="text-sm text-gray-400">Belum ada unit bisnis aktif. Hubungi superadmin untuk mengaktifkan unit.</p>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {activeUnits.map((unit) => {
            const meta = UNIT_META[unit.type]
            return (
              <a
                key={unit.type}
                href={meta.href}
                className="block bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow"
              >
                <div className={`w-10 h-10 rounded-lg ${meta.color} mb-4`} />
                <p className="font-semibold text-gray-900">{unit.name}</p>
                <p className="text-xs text-gray-400 mt-1">Lihat detail →</p>
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}


