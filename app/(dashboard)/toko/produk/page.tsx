import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'
import { ProdukClient } from './_components/produk-client'

export default async function ProdukPage({
  searchParams,
}: {
  searchParams: { search?: string; categoryId?: string; filter?: string }
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  const unit = await getTenantUnit(session.user.tenantId!, 'RETAIL')
  if (!unit) return <p className="text-red-500">Unit tidak ditemukan.</p>

  const search = searchParams.search ?? ''
  const categoryId = searchParams.categoryId ?? undefined
  const lowStockOnly = searchParams.filter === 'lowstock'

  const [produksRaw, categories] = await Promise.all([
    prisma.product.findMany({
      where: {
        unitId: unit.id,
        isActive: true,
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { sku: { contains: search, mode: 'insensitive' } },
          ],
        }),
        ...(categoryId && { categoryId }),
      },
      include: { category: true },
      orderBy: { name: 'asc' },
    }),
    prisma.category.findMany({ orderBy: { name: 'asc' } }),
  ])

  const produks = lowStockOnly
    ? produksRaw.filter((p) => Number(p.stock) <= Number(p.minStock))
    : produksRaw

  // Serialize Decimal → number
  const serialized = produks.map((p) => ({
    ...p,
    costPrice: Number(p.costPrice),
    sellPrice: Number(p.sellPrice),
    stock: Number(p.stock),
    minStock: Number(p.minStock),
    category: p.category ? { id: p.category.id, name: p.category.name } : null,
  }))

  return (
    <ProdukClient
      initialProducts={serialized}
      categories={categories}
      unitId={unit.id}
      userRole={session.user.role}
    />
  )
}


