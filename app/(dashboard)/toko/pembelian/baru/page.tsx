import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'
import { BuatPOClient } from './_components/buat-po-client'

export default async function BuatPOPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!['OWNER', 'MANAGER'].includes(session.user.role)) redirect('/toko/pembelian')

  const unit = await getTenantUnit(session.user.tenantId!, 'RETAIL')
  if (!unit) return <p>Unit tidak ditemukan.</p>

  const [suppliers, products] = await Promise.all([
    prisma.supplier.findMany({ where: { unitId: unit.id, isActive: true }, orderBy: { name: 'asc' } }),
    prisma.product.findMany({ where: { unitId: unit.id, isActive: true }, orderBy: { name: 'asc' } }),
  ])

  return (
    <BuatPOClient
      suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
      products={products.map((p) => ({
        id: p.id,
        name: p.name,
        unit: p.unit,
        costPrice: Number(p.costPrice),
        stock: Number(p.stock),
      }))}
    />
  )
}


