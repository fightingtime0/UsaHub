import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'
import { formatRupiah, formatDateTime } from '@/lib/utils'
import { startOfDay, endOfDay } from 'date-fns'
import Link from 'next/link'

const STATUS_BADGE: Record<string, string> = {
  PAID:      'bg-green-100 text-green-700',
  OPEN:      'bg-amber-100 text-amber-700',
  BILLED:    'bg-blue-100 text-blue-700',
  CANCELLED: 'bg-red-100 text-red-600',
}
const STATUS_LABEL: Record<string, string> = {
  PAID: 'Lunas', OPEN: 'Open', BILLED: 'Tagihan', CANCELLED: 'Batal',
}

export default async function RiwayatRestoranPage({
  searchParams,
}: {
  searchParams: { date?: string; page?: string }
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  const unit = await getTenantUnit(session.user.tenantId!, 'RESTAURANT')
  if (!unit) return <p>Unit tidak ditemukan.</p>

  const dateStr = searchParams.date ?? new Date().toISOString().slice(0, 10)
  const page = parseInt(searchParams.page ?? '1')
  const limit = 20

  const dateFilter = { gte: startOfDay(new Date(dateStr)), lte: endOfDay(new Date(dateStr)) }

  const [orders, total, agg] = await Promise.all([
    prisma.tableOrder.findMany({
      where: { unitId: unit.id, createdAt: dateFilter },
      include: {
        items: {
          where: { status: { not: 'CANCELLED' } },
          include: { menuItem: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.tableOrder.count({ where: { unitId: unit.id, createdAt: dateFilter } }),
    prisma.tableOrder.aggregate({
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
          <h1 className="text-2xl font-bold text-gray-900">Riwayat Order</h1>
          <p className="text-sm text-gray-500">
            {agg._count} order lunas · {formatRupiah(Number(agg._sum.total ?? 0))}
          </p>
        </div>
      </div>

      <form method="GET" className="flex items-center gap-3">
        <input type="date" name="date" defaultValue={dateStr}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <button type="submit" className="px-4 py-2 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors">
          Filter
        </button>
      </form>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-5 py-3 font-semibold">Order</th>
              <th className="px-5 py-3 font-semibold">Meja</th>
              <th className="px-5 py-3 font-semibold">Waktu</th>
              <th className="px-5 py-3 font-semibold">Item</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {orders.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-gray-400">Tidak ada order pada tanggal ini</td></tr>
            )}
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50">
                <td className="px-5 py-3.5">
                  {order.status === 'OPEN' || order.status === 'BILLED' ? (
                    <Link href={`/restoran/meja/${order.id}`} className="font-medium text-orange-600 hover:underline">
                      {order.orderNumber}
                    </Link>
                  ) : (
                    <span className="font-medium text-gray-900">{order.orderNumber}</span>
                  )}
                </td>
                <td className="px-5 py-3.5 font-semibold text-gray-800">Meja {order.tableNumber}</td>
                <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">{formatDateTime(order.createdAt)}</td>
                <td className="px-5 py-3.5 text-xs text-gray-600">
                  {order.items.slice(0, 2).map((i) => <div key={i.id}>{i.menuItem.name} ×{i.qty}</div>)}
                  {order.items.length > 2 && <div className="text-gray-400">+{order.items.length - 2} lagi</div>}
                </td>
                <td className="px-5 py-3.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[order.status]}`}>
                    {STATUS_LABEL[order.status]}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right font-semibold text-gray-900">
                  {formatRupiah(Number(order.total))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-600">
            <span>Halaman {page} dari {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 && <Link href={`?date=${dateStr}&page=${page - 1}`} className="px-3 py-1 rounded border border-gray-200 hover:bg-gray-50">← Sebelumnya</Link>}
              {page < totalPages && <Link href={`?date=${dateStr}&page=${page + 1}`} className="px-3 py-1 rounded border border-gray-200 hover:bg-gray-50">Berikutnya →</Link>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


