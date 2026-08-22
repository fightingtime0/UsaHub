import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'
import { formatRupiah, formatDateTime } from '@/lib/utils'
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns'
import Link from 'next/link'

const STATUS_BADGE: Record<string, string> = {
  PENDING:   'bg-amber-100 text-amber-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
}
const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Menunggu', CONFIRMED: 'Terkonfirmasi', COMPLETED: 'Selesai', CANCELLED: 'Batal',
}

export default async function KopiTeloPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const unit = await getTenantUnit(session.user.tenantId!, 'KOPI_TELO')
  if (!unit) return <p className="text-red-500">Unit Kopi Telo tidak ditemukan.</p>

  const now = new Date()

  const [hariIni, bulanIni, menunggu, mendatang, paketAktif] = await Promise.all([
    prisma.groupOrder.aggregate({
      where: {
        unitId: unit.id,
        status: { not: 'CANCELLED' },
        eventDate: { gte: startOfDay(now), lte: endOfDay(now) },
      },
      _sum: { pax: true, totalPrice: true },
      _count: true,
    }),
    prisma.groupOrder.aggregate({
      where: {
        unitId: unit.id,
        status: { not: 'CANCELLED' },
        eventDate: { gte: startOfMonth(now), lte: endOfMonth(now) },
      },
      _sum: { pax: true, totalPrice: true },
      _count: true,
    }),
    prisma.groupOrder.count({ where: { unitId: unit.id, status: 'PENDING' } }),
    prisma.groupOrder.findMany({
      where: {
        unitId: unit.id,
        status: { notIn: ['CANCELLED', 'COMPLETED'] },
        eventDate: { gte: startOfDay(now) },
      },
      orderBy: { eventDate: 'asc' },
      take: 10,
    }),
    prisma.menuItem.count({ where: { unitId: unit.id, isAvailable: true } }),
  ])

  const stats = [
    {
      label: 'Rombongan Hari Ini',
      value: String(hariIni._count),
      sub: (hariIni._sum.pax ?? 0) + ' peserta',
      color: 'bg-amber-500',
    },
    {
      label: 'Estimasi Omzet Hari Ini',
      value: formatRupiah(Number(hariIni._sum.totalPrice ?? 0)),
      sub: 'reservasi aktif',
      color: 'bg-orange-500',
    },
    {
      label: 'Rombongan Bulan Ini',
      value: String(bulanIni._count),
      sub: (bulanIni._sum.pax ?? 0) + ' peserta',
      color: 'bg-teal-500',
    },
    {
      label: 'Menunggu Konfirmasi',
      value: String(menunggu),
      sub: 'perlu ditindak',
      color: menunggu > 0 ? 'bg-red-500' : 'bg-gray-400',
    },
  ]

  const NAV = [
    {
      label: 'Reservasi',
      href: '/kopitelo/reservasi',
      icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    },
    {
      label: 'Paket',
      href: '/kopitelo/paket',
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
    },
    {
      label: 'Link Publik',
      href: '/kopitelo/link',
      icon: 'M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5M10.172 13.828a4 4 0 010-5.656l3-3a4 4 0 015.656 5.656l-1.5 1.5',
    },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 truncate">{unit.name}</h1>
          <p className="text-xs md:text-sm text-gray-500 mt-0.5 truncate">
            {unit.location ? unit.location + ' · ' : ''}Rest area rombongan travel
          </p>
        </div>
        <Link
          href="/kopitelo/reservasi"
          className="flex-shrink-0 px-3 py-2 text-xs md:text-sm font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors whitespace-nowrap"
        >
          Kelola Reservasi
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 md:p-5 flex items-start gap-3"
          >
            <div className={'w-8 h-8 md:w-10 md:h-10 rounded-lg flex-shrink-0 mt-0.5 ' + s.color} />
            <div className="min-w-0">
              <p className="text-xs text-gray-500 font-medium leading-tight">{s.label}</p>
              <p className="text-base md:text-xl font-bold text-gray-900 mt-0.5 truncate">{s.value}</p>
              <p className="text-xs text-gray-400">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Jadwal kedatangan */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-4 md:px-5 py-3 md:py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 text-sm md:text-base">Jadwal Kedatangan</h2>
            <Link href="/kopitelo/reservasi" className="text-xs text-amber-700 font-medium hover:underline">
              Lihat semua →
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {mendatang.length === 0 && (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">Belum ada reservasi mendatang</p>
            )}
            {mendatang.map((r) => (
              <div key={r.id} className="px-4 md:px-5 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 text-sm truncate">{r.customerName}</p>
                    <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + STATUS_BADGE[r.status]}>
                      {STATUS_LABEL[r.status]}
                    </span>
                    {r.source === 'WEB' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-purple-100 text-purple-700">
                        WEB
                      </span>
                    )}
                  </div>
                  {r.travelName && <p className="text-xs text-gray-500 mt-0.5 truncate">{r.travelName}</p>}
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatDateTime(r.eventDate)} · <span className="font-semibold">{r.pax} orang</span> · {r.menuType}
                  </p>
                </div>
                <p className="text-sm font-bold text-gray-800 flex-shrink-0">{formatRupiah(Number(r.totalPrice))}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Kolom kanan */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-5">
            <h2 className="font-semibold text-gray-900 text-sm md:text-base mb-1">Paket Makan</h2>
            <p className="text-xs text-gray-500 mb-3">
              {paketAktif} paket aktif — inilah pilihan yang muncul di form reservasi publik.
            </p>
            <Link href="/kopitelo/paket" className="text-xs text-amber-700 font-medium hover:underline">
              Kelola Paket →
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {NAV.map((nav) => (
              <Link
                key={nav.href}
                href={nav.href}
                className="bg-white border border-gray-100 shadow-sm rounded-xl p-3 flex flex-col items-center gap-1.5 hover:border-amber-300 hover:shadow-md transition-all group"
              >
                <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                  <svg
                    className="w-4 h-4 text-amber-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.8}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={nav.icon} />
                  </svg>
                </div>
                <span className="text-xs font-medium text-gray-700 text-center leading-tight">{nav.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
