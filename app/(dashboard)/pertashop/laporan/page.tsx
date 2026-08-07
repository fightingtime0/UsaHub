import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'
import { formatRupiah, formatDate } from '@/lib/utils'
import { startOfMonth, endOfMonth, subMonths, format, differenceInCalendarMonths } from 'date-fns'
import Link from 'next/link'
import { BiayaGajiSummary } from './_components/biaya-gaji-summary'
import { PengaturanInvestasiInline } from './_components/pengaturan-investasi-inline'

const LITER_FMT = { maximumFractionDigits: 2 }

// Cari stok aktual (hasil ukur tangki) terakhir yang tercatat pada/sebelum `cutoff`,
// dari gabungan belanja, penjualan, dan pengukuran stok berdiri sendiri.
// `inclusive=false` dipakai untuk "stok awal periode" (state sebelum periode dimulai).
async function getStockAtDate(fuelProductId: string, cutoff: Date, inclusive: boolean): Promise<number> {
  const [lastPurchase, lastSale, lastReading] = await Promise.all([
    prisma.fuelPurchase.findFirst({
      where: { fuelProductId, actualStock: { not: null }, purchasedAt: inclusive ? { lte: cutoff } : { lt: cutoff } },
      orderBy: { purchasedAt: 'desc' },
    }),
    prisma.fuelSale.findFirst({
      where: { fuelProductId, actualStock: { not: null }, soldAt: inclusive ? { lte: cutoff } : { lt: cutoff } },
      orderBy: { soldAt: 'desc' },
    }),
    prisma.fuelStockReading.findFirst({
      where: { fuelProductId, createdAt: inclusive ? { lte: cutoff } : { lt: cutoff } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const candidates: { at: Date; stock: number }[] = []
  if (lastPurchase) candidates.push({ at: lastPurchase.purchasedAt, stock: Number(lastPurchase.actualStock) })
  if (lastSale) candidates.push({ at: lastSale.soldAt, stock: Number(lastSale.actualStock) })
  if (lastReading) candidates.push({ at: lastReading.createdAt, stock: Number(lastReading.actualLiters) })
  if (candidates.length === 0) return 0
  candidates.sort((a, b) => b.at.getTime() - a.at.getTime())
  return candidates[0].stock
}

export default async function LaporanPertashopPage({
  searchParams: searchParamsRaw,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const searchParams = await searchParamsRaw
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.user.role !== 'OWNER') redirect('/pertashop')

  const monthStr = searchParams.month
  const now = monthStr ? new Date(`${monthStr}-01`) : new Date()
  const mStart = startOfMonth(now)
  const mEnd = endOfMonth(now)

  const unit = await getTenantUnit(session.user.tenantId!, 'PERTASHOP')
  if (!unit) return <p className="text-red-500">Unit Pertashop tidak ditemukan.</p>

  const [products, settings, payrollAgg, payrollPeriod, expenseAgg] = await Promise.all([
    prisma.fuelProduct.findMany({ where: { unitId: unit.id }, orderBy: { name: 'asc' } }),
    prisma.fuelSettings.findUnique({ where: { unitId: unit.id } }),
    prisma.payrollEntry.aggregate({ where: { period: { unitId: unit.id, month: mStart } }, _sum: { netTotal: true } }),
    prisma.payrollPeriod.findUnique({ where: { unitId_month: { unitId: unit.id, month: mStart } } }),
    prisma.fuelExpense.aggregate({ where: { unitId: unit.id, date: { gte: mStart, lte: mEnd } }, _sum: { amount: true } }),
  ])

  // ── Per-produk: belanja, penjualan, stok awal/akhir, loss ──
  const productReports = await Promise.all(
    products.map(async (p) => {
      const [purchases, saleAgg, purchaseAgg, readingLossAgg, stokAwal, stokAkhir] = await Promise.all([
        prisma.fuelPurchase.findMany({ where: { fuelProductId: p.id, purchasedAt: { gte: mStart, lte: mEnd } } }),
        prisma.fuelSale.aggregate({
          where: { fuelProductId: p.id, soldAt: { gte: mStart, lte: mEnd } },
          _sum: { liters: true, margin: true, total: true, lossLiters: true },
        }),
        prisma.fuelPurchase.aggregate({
          where: { fuelProductId: p.id, purchasedAt: { gte: mStart, lte: mEnd } },
          _sum: { liters: true, total: true, lossLiters: true },
        }),
        prisma.fuelStockReading.aggregate({
          where: { fuelProductId: p.id, date: { gte: mStart, lte: mEnd } },
          _sum: { lossLiters: true },
        }),
        getStockAtDate(p.id, mStart, false),
        getStockAtDate(p.id, mEnd, true),
      ])

      const lossLiter =
        Number(purchaseAgg._sum.lossLiters ?? 0) + Number(saleAgg._sum.lossLiters ?? 0) + Number(readingLossAgg._sum.lossLiters ?? 0)
      const lossRp = lossLiter * Number(p.sellPrice)

      // Kelompokkan belanja per ukuran DO + harga beli (harga bisa berubah di tengah bulan)
      const groups = new Map<string, { doSize: string; buyPrice: number; freq: number; totalHarga: number }>()
      for (const pu of purchases) {
        const key = `${pu.doSize ?? '—'}|${Number(pu.buyPrice)}`
        const g = groups.get(key) ?? { doSize: pu.doSize ?? '—', buyPrice: Number(pu.buyPrice), freq: 0, totalHarga: 0 }
        g.freq += 1
        g.totalHarga += Number(pu.total)
        groups.set(key, g)
      }

      return {
        product: p,
        belanjaGroups: Array.from(groups.values()),
        belanjaLiter: Number(purchaseAgg._sum.liters ?? 0),
        belanjaTotal: Number(purchaseAgg._sum.total ?? 0),
        terjualLiter: Number(saleAgg._sum.liters ?? 0),
        grossProfit: Number(saleAgg._sum.margin ?? 0),
        stokAwal,
        stokAkhir,
        lossLiter,
        lossRp,
      }
    })
  )

  const grossProfitTotal = Math.round(productReports.reduce((s, r) => s + r.grossProfit, 0))
  const lossRpTotal = Math.round(productReports.reduce((s, r) => s + r.lossRp, 0))
  const lossLiterTotal = productReports.reduce((s, r) => s + r.lossLiter, 0)
  const labaOperasional = grossProfitTotal - lossRpTotal

  const biayaGaji = Number(payrollAgg._sum.netTotal ?? 0)
  const biayaOprasional = Number(expenseAgg._sum.amount ?? 0)

  const investmentAmount = settings ? Number(settings.investmentAmount) : 0
  const usefulLifeYears = settings?.usefulLifeYears ?? 5
  const landRentPerMonth = settings ? Number(settings.landRentPerMonth) : 0
  const operationalStartDate = settings?.operationalStartDate ?? null
  const depresiasiPerTahun = usefulLifeYears > 0 ? Math.round(investmentAmount / usefulLifeYears) : 0
  const depresiasiPerBulan = Math.round(depresiasiPerTahun / 12)

  const monthsElapsed = operationalStartDate
    ? Math.max(0, differenceInCalendarMonths(mStart, startOfMonth(operationalStartDate)) + 1)
    : 0
  const sisaPenyusutan = Math.max(0, investmentAmount - depresiasiPerBulan * monthsElapsed)

  const labaBersih = labaOperasional - biayaGaji - biayaOprasional - depresiasiPerBulan - landRentPerMonth

  const prevMonth = format(subMonths(now, 1), 'yyyy-MM')
  const nextMonth = format(subMonths(now, -1), 'yyyy-MM')
  const isCurrentMonth = format(now, 'yyyy-MM') === format(new Date(), 'yyyy-MM')
  const currentMonthLabel = format(now, 'MMMM yyyy')

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/pertashop" className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Kembali">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Laporan Laba/Rugi Pertashop</h1>
            <p className="text-xs md:text-sm text-gray-500">
              Mulai Operasional: {operationalStartDate ? formatDate(operationalStartDate) : '— belum diatur'}
            </p>
          </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* BELANJA */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-4 md:px-5 py-3 md:py-4 border-b border-gray-100 bg-gray-50 rounded-t-xl">
            <h2 className="font-semibold text-gray-900 text-sm md:text-base">Belanja</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="px-4 md:px-5 py-2 font-medium">Produk</th>
                  <th className="px-2 py-2 font-medium">DO</th>
                  <th className="px-2 py-2 font-medium text-right">Frek.</th>
                  <th className="px-2 py-2 font-medium text-right">Total Harga</th>
                  <th className="px-2 py-2 font-medium text-right">Beli/L</th>
                  <th className="px-4 md:px-5 py-2 font-medium text-right">Profit/L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {productReports.every((r) => r.belanjaGroups.length === 0) && (
                  <tr>
                    <td colSpan={6} className="px-5 py-6 text-center text-gray-400">Belum ada belanja bulan ini</td>
                  </tr>
                )}
                {productReports.map((r) =>
                  r.belanjaGroups.map((g, i) => (
                    <tr key={`${r.product.id}-${i}`}>
                      <td className="px-4 md:px-5 py-2 text-gray-800 whitespace-nowrap">{r.product.name}</td>
                      <td className="px-2 py-2 text-gray-500">{g.doSize}</td>
                      <td className="px-2 py-2 text-right text-gray-600">{g.freq}</td>
                      <td className="px-2 py-2 text-right text-gray-800">{formatRupiah(g.totalHarga)}</td>
                      <td className="px-2 py-2 text-right text-gray-600">{formatRupiah(g.buyPrice)}</td>
                      <td className="px-4 md:px-5 py-2 text-right font-medium text-emerald-600">
                        {formatRupiah(Number(r.product.sellPrice) - g.buyPrice)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 font-semibold">
                  <td className="px-4 md:px-5 py-2.5 text-gray-700" colSpan={3}>Total</td>
                  <td className="px-2 py-2.5 text-right text-gray-900">
                    {formatRupiah(productReports.reduce((s, r) => s + r.belanjaTotal, 0))}
                  </td>
                  <td className="px-2 py-2.5 text-right text-gray-400" colSpan={2}>
                    {productReports.reduce((s, r) => s + r.belanjaLiter, 0).toLocaleString('id-ID', LITER_FMT)} L
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* PENJUALAN */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-4 md:px-5 py-3 md:py-4 border-b border-gray-100 bg-gray-50 rounded-t-xl flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 text-sm md:text-base">Penjualan</h2>
            <span className="text-xs font-semibold text-emerald-600">Gross Profit</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="px-4 md:px-5 py-2 font-medium">Produk</th>
                  <th className="px-2 py-2 font-medium text-right">Stok Awal</th>
                  <th className="px-2 py-2 font-medium text-right">Belanja</th>
                  <th className="px-2 py-2 font-medium text-right">Terjual</th>
                  <th className="px-2 py-2 font-medium text-right">Stok Akhir</th>
                  <th className="px-2 py-2 font-medium text-right">Selisih</th>
                  <th className="px-4 md:px-5 py-2 font-medium text-right">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {productReports.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-6 text-center text-gray-400">Belum ada produk BBM</td>
                  </tr>
                )}
                {productReports.map((r) => (
                  <tr key={r.product.id}>
                    <td className="px-4 md:px-5 py-2 text-gray-800 whitespace-nowrap">{r.product.name}</td>
                    <td className="px-2 py-2 text-right text-gray-600">{r.stokAwal.toLocaleString('id-ID', LITER_FMT)}</td>
                    <td className="px-2 py-2 text-right text-gray-600">{r.belanjaLiter.toLocaleString('id-ID', LITER_FMT)}</td>
                    <td className="px-2 py-2 text-right font-semibold text-blue-600">{r.terjualLiter.toLocaleString('id-ID', LITER_FMT)}</td>
                    <td className="px-2 py-2 text-right text-red-500">{r.stokAkhir.toLocaleString('id-ID', LITER_FMT)}</td>
                    <td className={`px-2 py-2 text-right font-medium ${r.lossLiter > 0 ? 'text-purple-600' : 'text-gray-400'}`}>
                      {r.lossLiter.toLocaleString('id-ID', LITER_FMT)}
                    </td>
                    <td className="px-4 md:px-5 py-2 text-right font-semibold text-blue-700">{formatRupiah(r.grossProfit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 md:px-5 py-3 border-t border-gray-100 bg-purple-50 flex items-center justify-between text-sm">
            <span className="text-purple-700 font-medium">
              Selisih (Loss) {lossLiterTotal.toLocaleString('id-ID', LITER_FMT)} L
            </span>
            <span className="font-bold text-purple-800">{formatRupiah(lossRpTotal)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* INVESTASI */}
        <PengaturanInvestasiInline
          settings={{
            investmentAmount,
            usefulLifeYears,
            landRentPerMonth,
            operationalStartDate: operationalStartDate ? operationalStartDate.toISOString() : null,
          }}
          computed={{ depresiasiPerTahun, depresiasiPerBulan, sisaPenyusutan }}
        />

        {/* LABA / RUGI */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-5 space-y-2.5">
          <h2 className="font-semibold text-gray-900 text-sm md:text-base mb-1">Laba / Rugi</h2>

          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Gross Profit</span>
            <span className="font-medium text-gray-900">{formatRupiah(grossProfitTotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Selisih (Loss)</span>
            <span className="font-medium text-red-600">−{formatRupiah(lossRpTotal)}</span>
          </div>
          <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
            <span className="text-gray-700 font-semibold">Laba Operasional</span>
            <span className={`font-bold ${labaOperasional >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatRupiah(labaOperasional)}</span>
          </div>

          <div className="pt-2 space-y-1.5 border-t border-gray-100">
            <BiayaGajiSummary
              month={format(mStart, 'yyyy-MM')}
              unitId={unit.id}
              amount={biayaGaji}
              filled={payrollPeriod !== null}
            />
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Biaya Oprasional</span>
              <span className="font-medium text-red-600">−{formatRupiah(biayaOprasional)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Biaya Penyusutan Modal</span>
              <span className="font-medium text-red-600">−{formatRupiah(depresiasiPerBulan)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Biaya Sewa Lahan</span>
              <span className="font-medium text-red-600">−{formatRupiah(landRentPerMonth)}</span>
            </div>
          </div>

          <div className="flex justify-between text-base pt-2.5 border-t border-gray-200">
            <span className="font-bold text-gray-900">Laba Bersih</span>
            <span className={`font-extrabold ${labaBersih >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatRupiah(labaBersih)}</span>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400">
        Catatan: Selisih (Loss) dinilai memakai harga jual produk saat ini (tidak ada riwayat harga historis).
        Biaya Gaji dihitung otomatis dari modul Gaji (SDM) — total gaji bersih semua karyawan unit ini bulan tsb.
        Biaya Oprasional dijumlahkan otomatis dari Biaya Pengeluaran yang dicatat saat input transaksi/rekonsiliasi.
      </p>
    </div>
  )
}
