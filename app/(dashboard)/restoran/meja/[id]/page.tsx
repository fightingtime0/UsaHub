import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { OrderMejaClient } from './_components/order-meja-client'

export default async function OrderMejaPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const order = await prisma.tableOrder.findUnique({
    where: { id: (await params).id },
    include: {
      items: {
        include: { menuItem: { select: { id: true, name: true, price: true } } },
        orderBy: { id: 'asc' },
      },
    },
  })

  if (!order) redirect('/restoran')

  const unit = await prisma.businessUnit.findUnique({
    where: { id: order.unitId },
    select: { name: true, location: true, taxRate: true, tenantId: true },
  })

  if (!unit || unit.tenantId !== session.user.tenantId) redirect('/restoran')

  const menuItems = await prisma.menuItem.findMany({
    where: { unitId: order.unitId, isAvailable: true },
    include: { menuCategory: { select: { id: true, name: true } } },
    orderBy: [{ menuCategoryId: 'asc' }, { name: 'asc' }],
  })

  const categories = await prisma.menuCategory.findMany({ orderBy: { name: 'asc' } })

  return (
    <OrderMejaClient
      order={{
        ...order,
        subtotal: Number(order.subtotal),
        discount: Number(order.discount),
        taxRate: Number(order.taxRate),
        tax: Number(order.tax),
        total: Number(order.total),
        items: order.items.map((i) => ({
          ...i,
          qty: Number(i.qty),
          price: Number(i.price),
          subtotal: Number(i.subtotal),
          menuItem: { ...i.menuItem, price: Number(i.menuItem.price) },
        })),
      }}
      menuItems={menuItems.map((m) => ({
        id: m.id,
        name: m.name,
        price: Number(m.price),
        taxRate: Number(m.taxRate),
        category: m.menuCategory,
      }))}
      categories={categories}
      taxRate={Number(unit?.taxRate ?? 0)}
      unitName={unit?.name ?? 'Restoran'}
      unitLocation={unit?.location ?? null}
    />
  )
}






