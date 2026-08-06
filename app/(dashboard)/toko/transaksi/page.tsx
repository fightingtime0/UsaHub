import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'
import { formatRupiah, formatDateTime } from '@/lib/utils'
import { startOfDay, endOfDay } from 'date-fns'
import Link from 'next/link'

const STATUS_BADGE: Record<string, string> = {
  PAID:    'bg-green-100 text-green-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  VOIDED:  'bg-red-100 text-red-700',
}
const STATUS_LABEL: Record<string, string> = {
  PAID: 'Lunas', PENDING: 'Pending', VOIDED: 'Dibatalkan',
}
const METHOD_LABEL: Record<string, string> = {
  CASH: 'Tunai', QRIS: 'QRIS', TRANSFER: 'Transfer', CARD: 'Kartu',
}

export default async function TransaksiPage({
  searchParams,
}: {
  searchParams: { date?: string; page?: string }
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  const unit = await getTenantUnit(session.user.tenantId!, 'RETAIL')
  if (!unit) return <p>Unit tidak ditemukan.</p>

  const dateStr = searchParams.date ?? new Date().toISOString().slice(0, 10)
  const page = parseInt(searchParams.page ?? '1')
  const limit = 20

  const dateFilter = {
    gte: startOfDay(new Date(dateStr)),
    lte: endOfDay(new Date(dateStr)),
  }

  const [transactions, total, aggregate] = await Promise.all([
    prisma.transaction.findMany({
      where: { unitId: unit.id, createdAt: dateFilter },
      include: {
        items: { include: { product: { select: { name: true, unit: true } } } },
        customer: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transaction.count({ where: { unitId: unit.id, createdAt: dateFilter } }),
    prisma.transaction.aggregate({
      where: { unitId: unit.id, status: 'PAID', createdAt: dateFilter },
      _sum: { total: true },
      _count: true,
    }),
  ])

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Riwayat Penjualan</h1>
          <p className="text-sm text-gray-500">
            {aggregate._count} transaksi · {formatRupiah(Number(aggregate._sum.total ?? 0))}
          </p>
        </div>
        <Link
          href="/toko/kasir"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
        >
          + Transaksi Baru
        </Link>
      </div>

      {/* Filter Tanggal */}
      <form method="GET" className="flex items-center gap-3">
        <input
          type="date"
          name="date"
          defaultValue={dateStr}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="px-4 py-2 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors"
        >
          Filter
        </button>
      </form>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-5 py-3 font-semibold">Invoice</th>
                <th className="px-5 py-3 font-semibold">Waktu</th>
                <th className="px-5 py-3 font-semibold">Item</th>
                <th className="px-5 py-3 font-semibold">Pelanggan</th>
                <th className="px-5 py-3 font-semibold">Metode</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-gray-400">
                    Tidak ada transaksi pada tanggal ini
                  </td>
                </tr>
              )}
              {transactions.map((trx) => (
                <tr key={trx.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{trx.invoiceNumber}</td>
                  <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">{formatDateTime(trx.createdAt)}</td>
                  <td className="px-5 py-3.5 text-gray-700">
                    <div className="text-xs space-y-0.5">
                      {trx.items.slice(0, 2).map((item) => (
                        <div key={item.id}>
                          {item.product.name} ×{Number(item.qty)}
                        </div>
                      ))}
                      {trx.items.length > 2 && (
                        <div className="text-gray-400">+{trx.items.length - 2} item lagi</div>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{trx.customer?.name ?? 'Umum'}</td>
                  <td className="px-5 py-3.5 text-gray-500">
                    {trx.paymentMethod ? METHOD_LABEL[trx.paymentMethod] ?? trx.paymentMethod : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[trx.status]}`}>
                      {STATUS_LABEL[trx.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold text-gray-900">
                    {formatRupiah(Number(trx.total))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-600">
            <span>Halaman {page} dari {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`?date=${dateStr}&page=${page - 1}`}
                  className="px-3 py-1 rounded border border-gray-200 hover:bg-gray-50"
                >
                  ← Sebelumnya
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`?date=${dateStr}&page=${page + 1}`}
                  className="px-3 py-1 rounded border border-gray-200 hover:bg-gray-50"
                >
                  Berikutnya →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


