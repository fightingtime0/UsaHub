import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getActiveUnitTypes } from '@/lib/tenant'
import { formatRupiah, formatDate } from '@/lib/utils'
import {
  startOfMonth, endOfMonth, subMonths, format,
  startOfDay, endOfDay, addDays,
} from 'date-fns'
import Link from 'next/link'

const UNIT_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  RETAIL:     { bg: 'bg-sky-50',     text: 'text-sky-700',     bar: 'bg-sky-500'     },
  RESTAURANT: { bg: 'bg-orange-50',  text: 'text-orange-700',  bar: 'bg-orange-500'  },
  LODGING:    { bg: 'bg-purple-50',  text: 'text-purple-700',  bar: 'bg-purple-500'  },
  HOMESTAY:   { bg: 'bg-teal-50',    text: 'text-teal-700',    bar: 'bg-teal-500'    },
  PERTASHOP:  { bg: 'bg-emerald-50', text: 'text-emerald-700', bar: 'bg-emerald-500' },
}
const UNIT_ICONS: Record<string, string> = {
  RETAIL:     '🛒',
  RESTAURANT: '🍽️',
  LODGING:    '🛏️',
  HOMESTAY:   '🏡',
  PERTASHOP:  '⛽',
}

export default async function LaporanPage({
  searchParams: searchParamsRaw,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const searchParams = await searchParamsRaw
  const session = await getSession()
  if (!session) redirect('/login')
  if (!['OWNER', 'MANAGER'].includes(session.user.role)) redirect('/dashboard')

  const tenantId = session.user.tenantId!
  const activeTypes = new Set(await getActiveUnitTypes(tenantId))

  const monthStr = searchParams.month
  const now      = monthStr ? new Date(`${monthStr}-01`) : new Date()
  const mStart   = startOfMonth(now)
  const mEnd     = endOfMonth(now)
  const today    = startOfDay(new Date())
  const todayEnd = endOfDay(new Date())
  const next7    = addDays(today, 7)

  // Build 6 months trend
  const trendMonths = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(now, 5 - i)
    return { label: format(d, 'MMM yy'), start: startOfMonth(d), end: endOfMonth(d) }
  })

  const [
    tokoRevenue,
    restoRevenue,
    penginapanRevenue,
    homestayRevenue,
    pertashopRevenue,
    b2bPaid,
    employeeCount,
    trendData,
    lowStock,
    checkInsToday,
    checkOutsToday,
    upcomingBookings,
    pendingPO,
    openTables,
  ] = await Promise.all([
    prisma.transaction.aggregate({
      where: { unit: { type: 'RETAIL', tenantId }, status: 'PAID', createdAt: { gte: mStart, lte: mEnd } },
      _sum: { total: true }, _count: { id: true },
    }),
    prisma.tableOrder.aggregate({
      where: { unit: { type: 'RESTAURANT', tenantId }, status: 'PAID', paidAt: { gte: mStart, lte: mEnd } },
      _sum: { total: true }, _count: { id: true },
    }),
    prisma.booking.aggregate({
      where: { unit: { type: 'LODGING', tenantId }, status: { in: ['CHECKED_IN', 'CHECKED_OUT'] }, checkIn: { gte: mStart, lte: mEnd } },
      _sum: { totalPrice: true }, _count: { id: true },
    }),
    prisma.booking.aggregate({
      where: { unit: { type: 'HOMESTAY', tenantId }, status: { in: ['CHECKED_IN', 'CHECKED_OUT'] }, checkIn: { gte: mStart, lte: mEnd } },
      _sum: { totalPrice: true }, _count: { id: true },
    }),
    prisma.fuelSale.aggregate({
      where: { unit: { type: 'PERTASHOP', tenantId }, soldAt: { gte: mStart, lte: mEnd } },
      _sum: { total: true }, _count: { id: true },
    }),
    prisma.b2BInvoice.aggregate({
      where: { status: 'PAID', paidAt: { gte: mStart, lte: mEnd }, sellerUnit: { tenantId } },
      _sum: { total: true }, _count: { id: true },
    }),
    prisma.employee.count({ where: { isActive: true, primaryUnit: { tenantId } } }),

    // Trend 6 months
    Promise.all(trendMonths.map(async (m) => {
      const [t, r, p, h, f] = await Promise.all([
        prisma.transaction.aggregate({ where: { unit: { type: 'RETAIL', tenantId }, status: 'PAID', createdAt: { gte: m.start, lte: m.end } }, _sum: { total: true } }),
        prisma.tableOrder.aggregate({ where: { unit: { type: 'RESTAURANT', tenantId }, status: 'PAID', paidAt: { gte: m.start, lte: m.end } }, _sum: { total: true } }),
        prisma.booking.aggregate({ where: { unit: { type: 'LODGING', tenantId }, status: { in: ['CHECKED_IN', 'CHECKED_OUT'] }, checkIn: { gte: m.start, lte: m.end } }, _sum: { totalPrice: true } }),
        prisma.booking.aggregate({ where: { unit: { type: 'HOMESTAY', tenantId }, status: { in: ['CHECKED_IN', 'CHECKED_OUT'] }, checkIn: { gte: m.start, lte: m.end } }, _sum: { totalPrice: true } }),
        prisma.fuelSale.aggregate({ where: { unit: { type: 'PERTASHOP', tenantId }, soldAt: { gte: m.start, lte: m.end } }, _sum: { total: true } }),
      ])
      return {
        label:      m.label,
        toko:       Number(t._sum.total ?? 0),
        restoran:   Number(r._sum.total ?? 0),
        penginapan: Number(p._sum.totalPrice ?? 0),
        homestay:   Number(h._sum.totalPrice ?? 0),
        pertashop:  Number(f._sum.total ?? 0),
      }
    })),

    // Low stock
    prisma.$queryRaw<{ name: string; stock: number; minStock: number; unit_name: string }[]>`
      SELECT p.name, CAST(p.stock AS FLOAT) as stock, CAST(p."minStock" AS FLOAT) as "minStock", bu.name as unit_name
      FROM products p JOIN business_units bu ON p."unitId" = bu.id
      WHERE p."isActive" = true AND p.stock <= p."minStock" AND p."minStock" > 0 AND bu."tenantId" = ${tenantId}
      ORDER BY (p.stock / NULLIF(p."minStock", 0)) ASC
      LIMIT 8
    `,

    prisma.booking.findMany({
      where: { status: { in: ['CONFIRMED', 'CHECKED_IN'] }, checkIn: { gte: today, lte: todayEnd }, unit: { tenantId } },
      include: { room: { select: { name: true } }, unit: { select: { name: true, type: true } } },
      orderBy: { checkIn: 'asc' },
    }),
    prisma.booking.findMany({
      where: { status: 'CHECKED_IN', checkOut: { gte: today, lte: todayEnd }, unit: { tenantId } },
      include: { room: { select: { name: true } }, unit: { select: { name: true, type: true } } },
    }),
    prisma.booking.findMany({
      where: { status: { in: ['CONFIRMED', 'PENDING'] }, checkIn: { gt: today, lte: next7 }, unit: { tenantId } },
      include: { unit: { select: { name: true, type: true } } },
      orderBy: { checkIn: 'asc' },
      take: 5,
    }),
    prisma.purchaseOrder.count({ where: { status: { in: ['DRAFT', 'ORDERED'] }, unit: { tenantId } } }),
    prisma.tableOrder.count({ where: { status: { in: ['OPEN', 'BILLED'] }, unit: { tenantId } } }),
  ])

  const tokoRev       = Number(tokoRevenue._sum.total ?? 0)
  const restoRev      = Number(restoRevenue._sum.total ?? 0)
  const penginapanRev = Number(penginapanRevenue._sum.totalPrice ?? 0)
  const homestayRev   = Number(homestayRevenue._sum.totalPrice ?? 0)
  const pertashopRev  = Number(pertashopRevenue._sum.total ?? 0)
  const grandTotal    = tokoRev + restoRev + penginapanRev + homestayRev + pertashopRev

  const unitData = [
    { label: 'Toko Retail',  type: 'RETAIL',     revenue: tokoRev,       count: Number(tokoRevenue._count.id)       },
    { label: 'Restoran',     type: 'RESTAURANT',  revenue: restoRev,      count: Number(restoRevenue._count.id)      },
    { label: 'Penginapan',   type: 'LODGING',     revenue: penginapanRev, count: Number(penginapanRevenue._count.id) },
    { label: 'Homestay',     type: 'HOMESTAY',    revenue: homestayRev,   count: Number(homestayRevenue._count.id)   },
    { label: 'Pertashop',    type: 'PERTASHOP',   revenue: pertashopRev,  count: Number(pertashopRevenue._count.id)  },
  ].filter((u) => activeTypes.has(u.type as any))

  const maxRevenue = Math.max(...unitData.map((u) => u.revenue), 1)

  // Month navigation
  const prevMonth = format(subMonths(now, 1), 'yyyy-MM')
  const nextMonth = format(subMonths(now, -1), 'yyyy-MM')
  const isCurrentMonth = format(now, 'yyyy-MM') === format(new Date(), 'yyyy-MM')

  const currentMonthLabel = format(now, 'MMMM yyyy')

  // Trend max for bar chart — hanya hitung dari unit yang aktif
  const trendSeries = [
    { key: 'toko' as const,       type: 'RETAIL',     label: 'Toko',       color: 'bg-sky-400'    },
    { key: 'restoran' as const,   type: 'RESTAURANT', label: 'Restoran',   color: 'bg-orange-400' },
    { key: 'penginapan' as const, type: 'LODGING',    label: 'Penginapan', color: 'bg-purple-400' },
    { key: 'homestay' as const,   type: 'HOMESTAY',   label: 'Homestay',   color: 'bg-teal-400'   },
    { key: 'pertashop' as const,  type: 'PERTASHOP',  label: 'Pertashop',  color: 'bg-emerald-400' },
  ].filter((s) => activeTypes.has(s.type as any))
  const trendMax = Math.max(...trendData.map((t) => trendSeries.reduce((s, series) => s + t[series.key], 0)), 1)

  return (
    <div className="space-y-6">
      {/* Header + month nav */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 truncate">Laporan Konsolidasi</h1>
          <p className="text-xs md:text-sm text-gray-500 mt-0.5">Ringkasan semua unit bisnis</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2 shadow-sm">
          <Link href={`?month=${prevMonth}`} className="text-gray-400 hover:text-gray-700 text-lg leading-none">‹</Link>
          <span className="text-sm font-semibold text-gray-700 w-32 text-center">{currentMonthLabel}</span>
          {!isCurrentMonth && (
            <Link href={`?month=${nextMonth}`} className="text-gray-400 hover:text-gray-700 text-lg leading-none">›</Link>
          )}
          {!isCurrentMonth && (
            <Link href="?" className="text-xs text-indigo-600 hover:underline ml-2">Bulan ini</Link>
          )}
        </div>
      </div>

      {/* Grand Total Banner */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-700 rounded-2xl px-7 py-6 text-white">
        <p className="text-sm text-gray-300">Total Pendapatan Konsolidasi</p>
        <p className="text-4xl font-bold mt-1">{formatRupiah(grandTotal)}</p>
        <p className="text-sm text-gray-400 mt-1">{currentMonthLabel} · {unitData.reduce((s, u) => s + u.count, 0)} transaksi</p>
      </div>

      {/* Unit breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {unitData.map((u) => {
          const pct   = grandTotal > 0 ? Math.round((u.revenue / grandTotal) * 100) : 0
          const color = UNIT_COLORS[u.type]
          return (
            <div key={u.type} className={`${color.bg} rounded-xl border border-gray-100 shadow-sm p-5`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{UNIT_ICONS[u.type]}</span>
                <p className={`text-sm font-semibold ${color.text}`}>{u.label}</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatRupiah(u.revenue)}</p>
              <p className="text-xs text-gray-500 mt-0.5">{u.count} transaksi · {pct}% dari total</p>
              <div className="mt-3 h-1.5 bg-white/60 rounded-full overflow-hidden">
                <div className={`h-full ${color.bar} rounded-full`} style={{ width: `${(u.revenue / maxRevenue) * 100}%` }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Quick stats */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Status Operasional</h2>
          <div className="space-y-3">
            {[
              ...(activeTypes.has('RESTAURANT' as any)
                ? [{ label: 'Meja Aktif Restoran', value: String(openTables), href: '/restoran', color: 'text-orange-600' }]
                : []),
              ...(activeTypes.has('RETAIL' as any)
                ? [{ label: 'PO Menunggu', value: String(pendingPO), href: '/toko/pembelian', color: 'text-sky-600' }]
                : []),
              { label: 'B2B Invoice Lunas/bln', value: String(Number(b2bPaid._count.id)), href: '/b2b', color: 'text-indigo-600' },
              { label: 'Total Karyawan Aktif',  value: String(employeeCount),   href: '/sdm',       color: 'text-gray-700' },
            ].map((item) => (
              <Link key={item.label} href={item.href}
                className="flex items-center justify-between p-3 rounded-lg border border-gray-50 hover:bg-gray-50 transition-colors group">
                <span className="text-sm text-gray-600 group-hover:text-gray-800">{item.label}</span>
                <span className={`text-lg font-bold ${item.color}`}>{item.value}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Check-in/out hari ini */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Penginapan Hari Ini</h2>
          <div className="space-y-1.5">
            {checkInsToday.length === 0 && checkOutsToday.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Tidak ada aktivitas hari ini</p>
            ) : (
              <>
                {checkInsToday.slice(0, 4).map((b) => (
                  <div key={b.id} className="flex items-center gap-2 text-xs p-2 bg-blue-50 rounded-lg">
                    <span className="text-blue-500 font-bold shrink-0">CI</span>
                    <span className="font-medium text-gray-700 truncate">{b.guestName}</span>
                    <span className="text-gray-400 shrink-0">{b.unit.name}</span>
                  </div>
                ))}
                {checkOutsToday.slice(0, 4).map((b) => (
                  <div key={b.id} className="flex items-center gap-2 text-xs p-2 bg-orange-50 rounded-lg">
                    <span className="text-orange-500 font-bold shrink-0">CO</span>
                    <span className="font-medium text-gray-700 truncate">{b.guestName}</span>
                    <span className="text-gray-400 shrink-0">{b.unit.name}</span>
                  </div>
                ))}
              </>
            )}
          </div>
          {upcomingBookings.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-50">
              <p className="text-xs text-gray-400 mb-1.5">Booking akan datang (7 hari)</p>
              {upcomingBookings.map((b) => (
                <div key={b.id} className="flex items-center justify-between text-xs py-1">
                  <span className="text-gray-700 truncate">{b.guestName}</span>
                  <span className="text-gray-400 shrink-0 ml-2">{formatDate(b.checkIn)} · {b.unit.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low stock alert */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <span className="text-red-500">⚠</span>
            Stok Menipis ({lowStock.length})
          </h2>
          {lowStock.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">Semua stok aman</p>
          ) : (
            <div className="space-y-2">
              {lowStock.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs p-2 bg-red-50 rounded-lg">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 truncate">{item.name}</p>
                    <p className="text-gray-400">{item.unit_name}</p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="font-bold text-red-600">{item.stock}</p>
                    <p className="text-gray-400">min: {item.minStock}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Trend 6 bulan */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-5">Tren Pendapatan 6 Bulan</h2>
        <div className="flex items-end gap-3 h-36">
          {trendData.map((m) => {
            const total = trendSeries.reduce((s, series) => s + m[series.key], 0)
            const pct   = (total / trendMax) * 100
            const isCurrentM = m.label === format(now, 'MMM yy')
            return (
              <div key={m.label} className="flex-1 flex flex-col items-center gap-1.5">
                <p className="text-xs font-semibold text-gray-600">{formatRupiah(total).replace('Rp', '').trim()}</p>
                <div className="w-full relative" style={{ height: `${Math.max(pct, 4)}%` }}>
                  {/* Stacked bar */}
                  <div className="w-full h-full rounded-t-lg overflow-hidden flex flex-col-reverse">
                    {trendSeries.map(({ key, color }) => (
                      <div key={color} className={`${color} w-full`}
                        style={{ height: total > 0 ? `${(m[key] / total) * 100}%` : '0%' }} />
                    ))}
                  </div>
                </div>
                <p className={`text-xs ${isCurrentM ? 'font-bold text-gray-800' : 'text-gray-400'}`}>{m.label}</p>
              </div>
            )
          })}
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-gray-50">
          {trendSeries.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded-sm ${item.color}`} />
              <span className="text-xs text-gray-500">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* B2B summary */}
      <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-indigo-800">B2B Invoice — Toko → Restoran</p>
          <p className="text-2xl font-bold text-indigo-700 mt-1">{formatRupiah(Number(b2bPaid._sum.total ?? 0))}</p>
          <p className="text-xs text-indigo-500 mt-0.5">{Number(b2bPaid._count.id)} invoice lunas bulan ini</p>
        </div>
        <Link href="/b2b"
          className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors">
          Kelola Invoice →
        </Link>
      </div>
    </div>
  )
}




