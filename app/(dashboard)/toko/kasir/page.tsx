import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'
import { KasirClient } from './_components/kasir-client'

export default async function KasirPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const unit = await getTenantUnit(session.user.tenantId!, 'RETAIL')
  if (!unit) return <p className="text-red-500">Unit tidak ditemukan.</p>

  const products = await prisma.product.findMany({
    where: { unitId: unit.id, isActive: true },
    include: { category: true },
    orderBy: { name: 'asc' },
  })

  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } })

  const serialized = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    unit: p.unit,
    sellPrice: Number(p.sellPrice),
    stock: Number(p.stock),
    imageUrl: p.imageUrl,
    category: p.category ? { id: p.category.id, name: p.category.name } : null,
  }))

  return (
    <KasirClient
      products={serialized}
      categories={categories}
      taxRate={Number(unit.taxRate)}
      unitName={unit.name}
      unitLocation={unit.location}
    />
  )
}


