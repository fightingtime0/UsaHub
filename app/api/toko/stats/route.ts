import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const unit = await getTenantUnit(session.user.tenantId!, 'RETAIL')
  if (!unit) return NextResponse.json({ error: 'Unit tidak ditemukan' }, { status: 404 })

  const now = new Date()
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  const [
    todayTrx,
    monthTrx,
    lowStockProducts,
    pendingPO,
    recentTransactions,
  ] = await Promise.all([
    // Transaksi & omzet hari ini
    prisma.transaction.aggregate({
      where: {
        unitId: unit.id,
        status: 'PAID',
        createdAt: { gte: todayStart, lte: todayEnd },
      },
      _sum: { total: true },
      _count: true,
    }),
    // Omzet bulan ini
    prisma.transaction.aggregate({
      where: {
        unitId: unit.id,
        status: 'PAID',
        createdAt: { gte: monthStart, lte: monthEnd },
      },
      _sum: { total: true },
      _count: true,
    }),
    // Produk stok menipis
    prisma.product.findMany({
      where: {
        unitId: unit.id,
        isActive: true,
        stock: { lte: prisma.product.fields.minStock }, // handled below
      },
      orderBy: { stock: 'asc' },
      take: 5,
    }).then(() =>
      // Prisma tidak support field-to-field comparison, pakai raw
      prisma.$queryRaw<{ id: string; name: string; stock: number; minStock: number; unit: string }[]>`
        SELECT id, name, stock, "minStock", unit
        FROM products
        WHERE "unitId" = ${unit.id}
          AND "isActive" = true
          AND stock <= "minStock"
        ORDER BY stock ASC
        LIMIT 5
      `
    ),
    // PO pending
    prisma.purchaseOrder.count({
      where: { unitId: unit.id, status: { in: ['DRAFT', 'ORDERED', 'PARTIAL'] } },
    }),
    // 5 transaksi terakhir
    prisma.transaction.findMany({
      where: { unitId: unit.id, status: 'PAID' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        invoiceNumber: true,
        total: true,
        paymentMethod: true,
        createdAt: true,
        customer: { select: { name: true } },
        _count: { select: { items: true } },
      },
    }),
  ])

  return NextResponse.json({
    unitId: unit.id,
    unitName: unit.name,
    today: {
      omzet: todayTrx._sum.total ?? 0,
      transaksi: todayTrx._count,
    },
    month: {
      omzet: monthTrx._sum.total ?? 0,
      transaksi: monthTrx._count,
    },
    lowStockProducts,
    pendingPO,
    recentTransactions,
  })
}



