import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'
import { formatRupiah, formatDate } from '@/lib/utils'
import Link from 'next/link'

const STATUS_BADGE: Record<string, string> = {
  DRAFT:     'bg-gray-100 text-gray-600',
  ORDERED:   'bg-blue-100 text-blue-700',
  PARTIAL:   'bg-amber-100 text-amber-700',
  RECEIVED:  'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
}
const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft', ORDERED: 'Dipesan', PARTIAL: 'Sebagian', RECEIVED: 'Diterima', CANCELLED: 'Dibatalkan',
}

export default async function PembelianPage({
  searchParams,
}: {
  searchParams: { status?: string }
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  const unit = await getTenantUnit(session.user.tenantId!, 'RETAIL')
  if (!unit) return <p>Unit tidak ditemukan.</p>

  const filterStatus = searchParams.status as any ?? undefined

  const orders = await prisma.purchaseOrder.findMany({
    where: { unitId: unit.id, ...(filterStatus && { status: filterStatus }) },
    include: {
      supplier: { select: { name: true } },
      items: { include: { product: { select: { name: true, unit: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const suppliers = await prisma.supplier.findMany({
    where: { unitId: unit.id, isActive: true },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Order</h1>
          <p className="text-sm text-gray-500">{orders.length} PO ditemukan</p>
        </div>
        <Link
          href="/toko/pembelian/baru"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
        >
          + Buat PO
        </Link>
      </div>

      {/* Filter Status */}
      <div className="flex gap-2 flex-wrap">
        {[undefined, 'DRAFT', 'ORDERED', 'PARTIAL', 'RECEIVED', 'CANCELLED'].map((s) => (
          <Link
            key={s ?? 'all'}
            href={s ? `?status=${s}` : '?'}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              filterStatus === s
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            {s ? STATUS_LABEL[s] : 'Semua'}
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-5 py-3 font-semibold">Nomor PO</th>
              <th className="px-5 py-3 font-semibold">Supplier</th>
              <th className="px-5 py-3 font-semibold">Tanggal</th>
              <th className="px-5 py-3 font-semibold">Item</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold text-right">Total</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-sm text-gray-400">
                  Belum ada purchase order
                </td>
              </tr>
            )}
            {orders.map((po) => {
              const canReceive = po.status === 'ORDERED' || po.status === 'PARTIAL'
              return (
                <tr key={po.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{po.orderNumber}</td>
                  <td className="px-5 py-3.5 text-gray-700">{po.supplier.name}</td>
                  <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">{formatDate(po.createdAt)}</td>
                  <td className="px-5 py-3.5 text-gray-700 text-xs">
                    {po.items.slice(0, 2).map((item) => (
                      <div key={item.id}>{item.product.name} ×{Number(item.qty)} {item.product.unit}</div>
                    ))}
                    {po.items.length > 2 && <div className="text-gray-400">+{po.items.length - 2} item</div>}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[po.status]}`}>
                      {STATUS_LABEL[po.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold text-gray-900">
                    {formatRupiah(Number(po.total))}
                  </td>
                  <td className="px-5 py-3.5">
                    {canReceive && (
                      <Link
                        href={`/toko/pembelian/${po.id}/terima`}
                        className="text-xs text-blue-600 hover:underline font-medium"
                      >
                        Terima Barang
                      </Link>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}


