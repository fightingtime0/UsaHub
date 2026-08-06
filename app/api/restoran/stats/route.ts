import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const unit = await getTenantUnit(session.user.tenantId!, 'RESTAURANT')
  if (!unit) return NextResponse.json({ error: 'Unit tidak ditemukan' }, { status: 404 })

  const now = new Date()

  const [todayOrders, monthOrders, openTables, lowStock, topMenus] = await Promise.all([
    prisma.tableOrder.aggregate({
      where: {
        unitId: unit.id,
        status: 'PAID',
        createdAt: { gte: startOfDay(now), lte: endOfDay(now) },
      },
      _sum: { total: true },
      _count: true,
    }),
    prisma.tableOrder.aggregate({
      where: {
        unitId: unit.id,
        status: 'PAID',
        createdAt: { gte: startOfMonth(now), lte: endOfMonth(now) },
      },
      _sum: { total: true },
      _count: true,
    }),
    prisma.tableOrder.findMany({
      where: { unitId: unit.id, status: { in: ['OPEN', 'BILLED'] } },
      include: {
        items: { include: { menuItem: { select: { name: true } } } },
      },
      orderBy: { openedAt: 'asc' },
    }),
    // Stok bahan baku menipis
    prisma.$queryRaw<{ id: string; name: string; stock: string; minStock: string; unit: string }[]>`
      SELECT id, name, stock::text, "minStock"::text, unit
      FROM products
      WHERE "unitId" = ${unit.id} AND "isActive" = true AND stock <= "minStock"
      ORDER BY stock ASC LIMIT 5
    `,
    // Menu terlaris hari ini
    prisma.tableOrderItem.groupBy({
      by: ['menuItemId'],
      where: {
        order: {
          unitId: unit.id,
          status: 'PAID',
          createdAt: { gte: startOfDay(now), lte: endOfDay(now) },
        },
      },
      _sum: { qty: true },
      orderBy: { _sum: { qty: 'desc' } },
      take: 5,
    }),
  ])

  // Resolve nama menu terlaris
  const menuIds = topMenus.map((m) => m.menuItemId)
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuIds } },
    select: { id: true, name: true, price: true },
  })
  const topMenusWithName = topMenus.map((m) => ({
    ...m,
    menuItem: menuItems.find((mi) => mi.id === m.menuItemId),
  }))

  return NextResponse.json({
    unitId: unit.id,
    unitName: unit.name,
    taxRate: Number(unit.taxRate),
    today: {
      omzet: Number(todayOrders._sum.total ?? 0),
      orders: todayOrders._count,
    },
    month: {
      omzet: Number(monthOrders._sum.total ?? 0),
      orders: monthOrders._count,
    },
    openTables,
    lowStock,
    topMenus: topMenusWithName,
  })
}



