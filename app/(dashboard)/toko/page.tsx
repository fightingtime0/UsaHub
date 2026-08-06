import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatRupiah, formatDateTime } from '@/lib/utils'
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns'

async function getTokoStats(tenantId: string) {
  const unit = await getTenantUnit(tenantId, 'RETAIL')
  if (!unit) return null

  const now = new Date()

  const [todayTrx, monthTrx, recentTrx] = await Promise.all([
    prisma.transaction.aggregate({
      where: { unitId: unit.id, status: 'PAID', createdAt: { gte: startOfDay(now), lte: endOfDay(now) } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: { unitId: unit.id, status: 'PAID', createdAt: { gte: startOfMonth(now), lte: endOfMonth(now) } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.transaction.findMany({
      where: { unitId: unit.id },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: {
        customer: { select: { name: true } },
        _count: { select: { items: true } },
      },
    }),
  ])

  // Stok menipis via raw query
  const lowStock = await prisma.$queryRaw<
    { id: string; name: string; stock: string; minStock: string; unit: string }[]
  >`
    SELECT id, name, stock::text, "minStock"::text, unit
    FROM products
    WHERE "unitId" = ${unit.id} AND "isActive" = true AND stock <= "minStock"
    ORDER BY stock ASC
    LIMIT 5
  `

  const pendingPO = await prisma.purchaseOrder.count({
    where: { unitId: unit.id, status: { in: ['DRAFT', 'ORDERED', 'PARTIAL'] } },
  })

  return { unit, todayTrx, monthTrx, recentTrx, lowStock, pendingPO }
}

const STATUS_BADGE: Record<string, string> = {
  PAID:    'bg-green-100 text-green-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  VOIDED:  'bg-red-100 text-red-700',
}
const STATUS_LABEL: Record<string, string> = {
  PAID: 'Lunas', PENDING: 'Pending', VOIDED: 'Batal',
}

export default async function TokoPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const data = await getTokoStats(session.user.tenantId!)
  if (!data) return <p className="text-red-500">Unit Toko tidak ditemukan.</p>

  const { unit, todayTrx, monthTrx, recentTrx, lowStock, pendingPO } = data

  const stats = [
    {
      label: 'Omzet Hari Ini',
      value: formatRupiah(Number(todayTrx._sum.total ?? 0)),
      sub: `${todayTrx._count} transaksi`,
      color: 'bg-blue-500',
      icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    },
    {
      label: 'Omzet Bulan Ini',
      value: formatRupiah(Number(monthTrx._sum.total ?? 0)),
      sub: `${monthTrx._count} transaksi`,
      color: 'bg-indigo-500',
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    },
    {
      label: 'Stok Menipis',
      value: lowStock.length.toString(),
      sub: 'produk perlu restock',
      color: lowStock.length > 0 ? 'bg-red-500' : 'bg-gray-400',
      icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    },
    {
      label: 'PO Belum Selesai',
      value: pendingPO.toString(),
      sub: 'purchase order pending',
      color: pendingPO > 0 ? 'bg-amber-500' : 'bg-gray-400',
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 truncate">{unit.name}</h1>
          {unit.location && <p className="text-xs md:text-sm text-gray-500 mt-0.5 truncate">{unit.location}</p>}
        </div>
        <Link
          href="/toko/kasir"
          className="flex-shrink-0 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-3 md:px-4 py-2 md:py-2.5 rounded-lg transition-colors whitespace-nowrap"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Buka Kasir
        </Link>
      </div>

      {/* Stats Cards — 2 kolom di mobile, 4 di desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 md:p-5 flex items-start gap-3">
            <div className={`w-8 h-8 md:w-10 md:h-10 ${s.color} rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5`}>
              <svg className="w-4 h-4 md:w-5 md:h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 font-medium leading-tight">{s.label}</p>
              <p className="text-base md:text-xl font-bold text-gray-900 mt-0.5 truncate">{s.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Transaksi Terakhir */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Transaksi Terakhir</h2>
            <Link href="/toko/transaksi" className="text-xs text-blue-600 hover:underline">
              Lihat semua →
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentTrx.length === 0 && (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">Belum ada transaksi hari ini</p>
            )}
            {recentTrx.map((trx) => (
              <div key={trx.id} className="px-4 md:px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{trx.invoiceNumber}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {trx.customer?.name ?? 'Umum'} · {trx._count.items} item
                    <span className="hidden sm:inline"> · {formatDateTime(trx.createdAt)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`hidden sm:inline text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[trx.status]}`}>
                    {STATUS_LABEL[trx.status]}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">{formatRupiah(Number(trx.total))}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stok Menipis */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Stok Menipis</h2>
            <Link href="/toko/produk?filter=lowstock" className="text-xs text-blue-600 hover:underline">
              Lihat semua →
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {lowStock.length === 0 && (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">Semua stok aman ✓</p>
            )}
            {lowStock.map((p) => (
              <div key={p.id} className="px-5 py-3.5">
                <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-semibold text-red-600">
                    Sisa: {p.stock} {p.unit}
                  </span>
                  <span className="text-xs text-gray-400">/ min {p.minStock} {p.unit}</span>
                </div>
              </div>
            ))}
          </div>
          {lowStock.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100">
              <Link
                href="/toko/pembelian/baru"
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                + Buat Purchase Order
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Quick Nav */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Produk & Stok', href: '/toko/produk', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
          { label: 'Purchase Order', href: '/toko/pembelian', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
          { label: 'Riwayat Penjualan', href: '/toko/transaksi', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
        ].map((nav) => (
          <Link
            key={nav.href}
            href={nav.href}
            className="bg-white border border-gray-100 shadow-sm rounded-xl p-4 flex flex-col items-center gap-2 hover:border-blue-300 hover:shadow-md transition-all group"
          >
            <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center group-hover:bg-blue-100 transition-colors">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d={nav.icon} />
              </svg>
            </div>
            <span className="text-xs font-medium text-gray-700 text-center">{nav.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}



