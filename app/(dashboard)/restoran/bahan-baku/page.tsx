import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'
import { formatRupiah } from '@/lib/utils'
import Link from 'next/link'

export default async function BahanBakuPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const unit = await getTenantUnit(session.user.tenantId!, 'RESTAURANT')
  if (!unit) return <p>Unit tidak ditemukan.</p>

  const products = await prisma.product.findMany({
    where: { unitId: unit.id, isActive: true },
    orderBy: { name: 'asc' },
  })

  const lowStockIds = products
    .filter((p) => Number(p.stock) <= Number(p.minStock))
    .map((p) => p.id)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bahan Baku Restoran</h1>
          <p className="text-sm text-gray-500">
            {products.length} bahan · {lowStockIds.length} menipis
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/restoran/menu" className="px-4 py-2.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            ← Kelola Menu
          </Link>
        </div>
      </div>

      {lowStockIds.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-red-700">{lowStockIds.length} bahan baku di bawah stok minimum</p>
            <p className="text-xs text-red-600 mt-0.5">Beli via B2B Invoice dari Toko atau Purchase Order langsung ke supplier.</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-5 py-3 font-semibold">Bahan Baku</th>
              <th className="px-5 py-3 font-semibold text-right">Stok</th>
              <th className="px-5 py-3 font-semibold text-right">Min Stok</th>
              <th className="px-5 py-3 font-semibold text-right">HPP/Satuan</th>
              <th className="px-5 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {products.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-gray-400">Belum ada bahan baku terdaftar</td></tr>
            )}
            {products.map((p) => {
              const isLow = Number(p.stock) <= Number(p.minStock)
              return (
                <tr key={p.id} className={`hover:bg-gray-50 ${isLow ? 'bg-red-50/30' : ''}`}>
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-gray-900">{p.name}</p>
                    {p.sku && <p className="text-xs text-gray-400">{p.sku}</p>}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className={`font-bold ${isLow ? 'text-red-600' : 'text-gray-900'}`}>
                      {Number(p.stock)}
                    </span>
                    <span className="text-gray-400 ml-1 text-xs">{p.unit}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right text-gray-500">
                    {Number(p.minStock)} <span className="text-xs">{p.unit}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right text-gray-700">{formatRupiah(Number(p.costPrice))}</td>
                  <td className="px-5 py-3.5">
                    {isLow ? (
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">Menipis</span>
                    ) : (
                      <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-medium">Cukup</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4">
        <p className="text-sm font-semibold text-blue-800 mb-1">Cara menambah stok bahan baku:</p>
        <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
          <li>Beli dari Toko via <strong>B2B Invoice</strong> (saat invoice PAID, stok restoran otomatis bertambah)</li>
          <li>Beli langsung ke supplier via Purchase Order restoran</li>
          <li>Stok otomatis berkurang setiap kali order meja dibayar (berdasarkan resep menu)</li>
        </ul>
      </div>
    </div>
  )
}


