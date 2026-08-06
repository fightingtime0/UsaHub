import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'
import { B2BInvoiceFormClient } from './_components/invoice-form-client'

export default async function B2BBaruPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!['OWNER', 'MANAGER'].includes(session.user.role)) redirect('/dashboard')

  const [units, tokoUnit] = await Promise.all([
    prisma.businessUnit.findMany({ where: { isActive: true, tenantId: session.user.tenantId }, select: { id: true, name: true, type: true, taxRate: true } }),
    getTenantUnit(session.user.tenantId!, 'RETAIL'),
  ])

  const tokoProducts = tokoUnit ? await prisma.product.findMany({
    where: { unitId: tokoUnit.id, isActive: true, stock: { gt: 0 } },
    select: { id: true, name: true, unit: true, sellPrice: true, stock: true },
    orderBy: { name: 'asc' },
  }) : []

  const serializedProducts = tokoProducts.map((p) => ({
    ...p,
    sellPrice: Number(p.sellPrice),
    stock:     Number(p.stock),
  }))

  const serializedUnits = units.map((u) => ({ ...u, taxRate: Number(u.taxRate) }))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Buat Invoice B2B</h1>
        <p className="text-sm text-gray-500 mt-0.5">Pengiriman barang antar unit bisnis</p>
      </div>
      <B2BInvoiceFormClient
        units={serializedUnits}
        defaultSellerUnitId={tokoUnit?.id ?? ''}
        products={serializedProducts}
      />
    </div>
  )
}


