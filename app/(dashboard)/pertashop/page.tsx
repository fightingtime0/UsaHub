import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'
import { formatRupiah, formatDate } from '@/lib/utils'
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns'
import Link from 'next/link'

async function getPertashopData(tenantId: string) {
  const unit = await getTenantUnit(tenantId, 'PERTASHOP')
  if (!unit) return null

  const now = new Date()

  const [products, todaySales, monthSales, monthPurchases, monthLossIn, monthLossOut, recentRecons] = await Promise.all([
    prisma.fuelProduct.findMany({ where: { unitId: unit.id, isActive: true }, orderBy: { name: 'asc' } }),
    prisma.fuelSale.aggregate({
      where: { unitId: unit.id, soldAt: { gte: startOfDay(now), lte: endOfDay(now) } },
      _sum: { total: true, liters: true, margin: true },
      _count: true,
    }),
    prisma.fuelSale.aggregate({
      where: { unitId: unit.id, soldAt: { gte: startOfMonth(now), lte: endOfMonth(now) } },
      _sum: { total: true, liters: true, margin: true },
      _count: true,
    }),
    prisma.fuelPurchase.aggregate({
      where: { unitId: unit.id, purchasedAt: { gte: startOfMonth(now), lte: endOfMonth(now) } },
      _sum: { total: true, liters: true },
      _count: true,
    }),
    // Loss/susut kini tercatat per transaksi (masuk & keluar), bukan lagi pengukuran 2x/hari
    prisma.fuelPurchase.aggregate({
      where: { unitId: unit.id, purchasedAt: { gte: startOfMonth(now), lte: endOfMonth(now) } },
      _sum: { lossLiters: true },
    }),
    prisma.fuelSale.aggregate({
      where: { unitId: unit.id, soldAt: { gte: startOfMonth(now), lte: endOfMonth(now) } },
      _sum: { lossLiters: true },
    }),
    prisma.fuelReconciliation.findMany({
      where: { unitId: unit.id },
      orderBy: { date: 'desc' },
      take: 5,
    }),
  ])

  const monthLoss = Number(monthLossIn._sum.lossLiters ?? 0) + Number(monthLossOut._sum.lossLiters ?? 0)

  return { unit, products, todaySales, monthSales, monthPurchases, monthLoss, recentRecons }
}

export default async function PertashopPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const data = await getPertashopData(session.user.tenantId!)
  if (!data) return <p className="text-red-500">Unit Pertashop tidak ditemukan. Tambahkan unit bisnis bertipe PERTASHOP terlebih dulu.</p>

  const { unit, products, todaySales, monthSales, monthPurchases, monthLoss, recentRecons } = data

  const lossMonth = monthLoss
  // Operator (STAFF) tidak boleh tahu margin/profit — turunan dari harga beli yang dirahasiakan.
  const isStaff = session.user.role === 'STAFF'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 truncate">{unit.name}</h1>
          {unit.location && (
            <p className="text-xs md:text-sm text-gray-500 mt-0.5 truncate">{unit.location}</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Sales Hari Ini',
            value: formatRupiah(Number(todaySales._sum.total ?? 0)),
            sub: `${Number(todaySales._sum.liters ?? 0).toLocaleString('id-ID')} liter`,
            color: 'bg-emerald-500',
          },
          ...(isStaff ? [] : [{
            label: 'Margin Bulan Ini',
            value: formatRupiah(Number(monthSales._sum.margin ?? 0)),
            sub: `dari ${formatRupiah(Number(monthSales._sum.total ?? 0))} sales`,
            color: 'bg-teal-500',
          }]),
          {
            label: 'Belanja Bulan Ini',
            value: formatRupiah(Number(monthPurchases._sum.total ?? 0)),
            sub: `${Number(monthPurchases._sum.liters ?? 0).toLocaleString('id-ID')} liter`,
            color: 'bg-blue-500',
          },
          {
            label: 'Loss Bulan Ini',
            value: `${lossMonth.toLocaleString('id-ID', { maximumFractionDigits: 2 })} L`,
            sub: 'penguapan / susut',
            color: lossMonth > 0 ? 'bg-red-500' : 'bg-gray-400',
          },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 md:p-5 flex items-start gap-3">
            <div className={`w-8 h-8 md:w-10 md:h-10 ${s.color} rounded-lg flex-shrink-0 mt-0.5`} />
            <div className="min-w-0">
              <p className="text-xs text-gray-500 font-medium leading-tight">{s.label}</p>
              <p className="text-base md:text-xl font-bold text-gray-900 mt-0.5 truncate">{s.value}</p>
              <p className="text-xs text-gray-400">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Stok & margin per produk */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-4 md:px-5 py-3 md:py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm md:text-base">{isStaff ? 'Stok BBM' : 'Stok & Margin BBM'}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="px-4 md:px-5 py-2.5 font-medium">Produk</th>
                  <th className="px-3 py-2.5 font-medium text-right">Stok (L)</th>
                  {!isStaff && <th className="px-3 py-2.5 font-medium text-right">Harga Beli/L</th>}
                  <th className="px-3 py-2.5 font-medium text-right">Harga Jual/L</th>
                  {!isStaff && <th className="px-4 md:px-5 py-2.5 font-medium text-right">Margin/L</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {products.length === 0 && (
                  <tr>
                    <td colSpan={isStaff ? 3 : 5} className="px-5 py-6 text-center text-gray-400">
                      Belum ada produk BBM. Tambahkan lewat halaman Belanja.
                    </td>
                  </tr>
                )}
                {products.map((p) => {
                  const marginPerL = Number(p.sellPrice) - Number(p.buyPrice)
                  return (
                    <tr key={p.id}>
                      <td className="px-4 md:px-5 py-3 font-medium text-gray-900">{p.name}</td>
                      <td className="px-3 py-3 text-right font-semibold text-gray-800">
                        {Number(p.stock).toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                      </td>
                      {!isStaff && <td className="px-3 py-3 text-right text-gray-600">{formatRupiah(Number(p.buyPrice))}</td>}
                      <td className="px-3 py-3 text-right text-gray-600">{formatRupiah(Number(p.sellPrice))}</td>
                      {!isStaff && (
                        <td className={`px-4 md:px-5 py-3 text-right font-semibold ${marginPerL >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {formatRupiah(marginPerL)}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Kolom kanan */}
        <div className="space-y-4">
          {/* Rekonsiliasi terakhir */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="px-4 md:px-5 py-3 md:py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 text-sm md:text-base">Rekonsiliasi Terakhir</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {recentRecons.length === 0 && (
                <p className="px-4 md:px-5 py-5 text-sm text-gray-400 text-center">Belum ada rekonsiliasi</p>
              )}
              {recentRecons.map((r) => {
                const diff = Number(r.difference)
                return (
                  <div key={r.id} className="px-4 md:px-5 py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{formatDate(r.date)}</p>
                      <p className="text-xs text-gray-400">Setoran {formatRupiah(Number(r.depositAmount))}</p>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${
                        diff === 0
                          ? 'bg-emerald-100 text-emerald-700'
                          : diff > 0
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {diff === 0 ? 'Cocok' : `${diff > 0 ? '+' : ''}${formatRupiah(diff)}`}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Quick nav */}
          <div className="grid grid-cols-2 gap-2.5">
            {[
              ...(isStaff
                ? [{ label: 'Input Penjualan', href: '/pertashop/penjualan', icon: 'M12 4v16m8-8H4' }]
                : [{ label: 'Semua Transaksi', href: '/pertashop/transaksi', icon: 'M12 4v16m8-8H4' },
                   { label: 'Rekonsiliasi', href: '/pertashop/rekonsiliasi', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' }]),
              ...(session.user.role === 'OWNER'
                ? [{ label: 'Laporan Laba/Rugi', href: '/pertashop/laporan', icon: 'M9 19v-6a2 2 0 012-2h2a2 2 0 012 2v6m-9 0h10a2 2 0 002-2V7a2 2 0 00-2-2h-3l-2-2H8a2 2 0 00-2 2v13a2 2 0 002 2z' }]
                : []),
            ].map((nav) => (
              <Link
                key={nav.href}
                href={nav.href}
                className="bg-white border border-gray-100 shadow-sm rounded-xl p-3 flex flex-col items-center gap-1.5 hover:border-emerald-300 hover:shadow-md transition-all group"
              >
                <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
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
