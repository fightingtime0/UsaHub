import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'
import { MenuClient } from './_components/menu-client'

export default async function MenuPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const unit = await getTenantUnit(session.user.tenantId!, 'RESTAURANT')
  if (!unit) return <p>Unit tidak ditemukan.</p>

  const [menuItems, categories, products] = await Promise.all([
    prisma.menuItem.findMany({
      where: { unitId: unit.id },
      include: {
        menuCategory: true,
        ingredients: { include: { product: { select: { id: true, name: true, unit: true } } } },
      },
      orderBy: [{ menuCategoryId: 'asc' }, { name: 'asc' }],
    }),
    prisma.menuCategory.findMany({ orderBy: { name: 'asc' } }),
    // Produk bahan baku milik restoran
    prisma.product.findMany({
      where: { unitId: unit.id, isActive: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return (
    <MenuClient
      menuItems={menuItems.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        price: Number(m.price),
        taxRate: Number(m.taxRate),
        isAvailable: m.isAvailable,
        menuCategory: m.menuCategory,
        ingredients: m.ingredients.map((ing) => ({
          id: ing.id,
          qtyUsed: Number(ing.qtyUsed),
          product: ing.product,
        })),
      }))}
      categories={categories}
      products={products.map((p) => ({ id: p.id, name: p.name, unit: p.unit }))}
      taxRate={Number(unit.taxRate)}
      userRole={session.user.role}
    />
  )
}


