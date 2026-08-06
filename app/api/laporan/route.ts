import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths, format } from 'date-fns'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const tenantId = session.user.tenantId

  const { searchParams } = req.nextUrl
  const monthStr = searchParams.get('month') // "2025-06"
  const now      = monthStr ? new Date(`${monthStr}-01`) : new Date()
  const mStart   = startOfMonth(now)
  const mEnd     = endOfMonth(now)

  // Build 6 months trend
  const trendMonths = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(now, 5 - i)
    return { label: format(d, 'MMM yy'), start: startOfMonth(d), end: endOfMonth(d) }
  })

  const [
    units,
    tokoRevenue,
    tokoTransactions,
    restoranRevenue,
    restoranOrders,
    penginapanRevenue,
    penginapanBookings,
    homestayRevenue,
    homestayBookings,
    pertashopRevenue,
    b2bRevenue,
    employeeCount,
    trendData,
    lowStockRaw,
    pendingBookings,
  ] = await Promise.all([
    prisma.businessUnit.findMany({ where: { isActive: true, tenantId }, select: { id: true, name: true, type: true } }),

    // Toko
    prisma.transaction.aggregate({
      where: { unit: { type: 'RETAIL', tenantId }, status: 'PAID', createdAt: { gte: mStart, lte: mEnd } },
      _sum: { total: true }, _count: { id: true },
    }),
    prisma.transaction.count({ where: { unit: { type: 'RETAIL', tenantId }, createdAt: { gte: mStart, lte: mEnd } } }),

    // Restoran
    prisma.tableOrder.aggregate({
      where: { unit: { type: 'RESTAURANT', tenantId }, status: 'PAID', paidAt: { gte: mStart, lte: mEnd } },
      _sum: { total: true }, _count: { id: true },
    }),
    prisma.tableOrder.count({ where: { unit: { type: 'RESTAURANT', tenantId }, createdAt: { gte: mStart, lte: mEnd } } }),

    // Penginapan
    prisma.booking.aggregate({
      where: { unit: { type: 'LODGING', tenantId }, status: { in: ['CHECKED_IN', 'CHECKED_OUT'] }, checkIn: { gte: mStart, lte: mEnd } },
      _sum: { totalPrice: true }, _count: { id: true },
    }),
    prisma.booking.count({ where: { unit: { type: 'LODGING', tenantId }, createdAt: { gte: mStart, lte: mEnd } } }),

    // Homestay
    prisma.booking.aggregate({
      where: { unit: { type: 'HOMESTAY', tenantId }, status: { in: ['CHECKED_IN', 'CHECKED_OUT'] }, checkIn: { gte: mStart, lte: mEnd } },
      _sum: { totalPrice: true }, _count: { id: true },
    }),
    prisma.booking.count({ where: { unit: { type: 'HOMESTAY', tenantId }, createdAt: { gte: mStart, lte: mEnd } } }),

    // Pertashop
    prisma.fuelSale.aggregate({
      where: { unit: { type: 'PERTASHOP', tenantId }, soldAt: { gte: mStart, lte: mEnd } },
      _sum: { total: true }, _count: { id: true },
    }),

    // B2B
    prisma.b2BInvoice.aggregate({
      where: { status: 'PAID', paidAt: { gte: mStart, lte: mEnd }, sellerUnit: { tenantId } },
      _sum: { total: true }, _count: { id: true },
    }),

    // Karyawan
    prisma.employee.count({ where: { isActive: true, primaryUnit: { tenantId } } }),

    // Trend 6 bulan
    Promise.all(trendMonths.map(async (m) => {
      const [toko, resto, penginapan, homestay, pertashop] = await Promise.all([
        prisma.transaction.aggregate({
          where: { unit: { type: 'RETAIL', tenantId }, status: 'PAID', createdAt: { gte: m.start, lte: m.end } },
          _sum: { total: true },
        }),
        prisma.tableOrder.aggregate({
          where: { unit: { type: 'RESTAURANT', tenantId }, status: 'PAID', paidAt: { gte: m.start, lte: m.end } },
          _sum: { total: true },
        }),
        prisma.booking.aggregate({
          where: { unit: { type: 'LODGING', tenantId }, status: { in: ['CHECKED_IN', 'CHECKED_OUT'] }, checkIn: { gte: m.start, lte: m.end } },
          _sum: { totalPrice: true },
        }),
        prisma.booking.aggregate({
          where: { unit: { type: 'HOMESTAY', tenantId }, status: { in: ['CHECKED_IN', 'CHECKED_OUT'] }, checkIn: { gte: m.start, lte: m.end } },
          _sum: { totalPrice: true },
        }),
        prisma.fuelSale.aggregate({
          where: { unit: { type: 'PERTASHOP', tenantId }, soldAt: { gte: m.start, lte: m.end } },
          _sum: { total: true },
        }),
      ])
      return {
        label:       m.label,
        toko:        Number(toko._sum.total ?? 0),
        restoran:    Number(resto._sum.total ?? 0),
        penginapan:  Number(penginapan._sum.totalPrice ?? 0),
        homestay:    Number(homestay._sum.totalPrice ?? 0),
        pertashop:   Number(pertashop._sum.total ?? 0),
      }
    })),

    // Low stock
    prisma.$queryRaw<{ name: string; stock: number; minStock: number; unit: string }[]>`
      SELECT p.name, CAST(p.stock AS FLOAT) as stock, CAST(p.min_stock AS FLOAT) as "minStock", p.unit
      FROM products p
      JOIN business_units bu ON bu.id = p.unit_id
      WHERE p.is_active = true AND p.stock <= p.min_stock AND p.min_stock > 0 AND bu.tenant_id = ${tenantId}
      ORDER BY (p.stock / NULLIF(p.min_stock, 0)) ASC
      LIMIT 10
    `,

    // Pending bookings
    prisma.booking.count({ where: { status: { in: ['PENDING', 'CONFIRMED'] }, unit: { tenantId } } }),
  ])

  const tokoRev        = Number(tokoRevenue._sum.total ?? 0)
  const restoRev       = Number(restoranRevenue._sum.total ?? 0)
  const penginapanRev  = Number(penginapanRevenue._sum.totalPrice ?? 0)
  const homestayRev    = Number(homestayRevenue._sum.totalPrice ?? 0)
  const pertashopRev   = Number(pertashopRevenue._sum.total ?? 0)
  const grandTotal     = tokoRev + restoRev + penginapanRev + homestayRev + pertashopRev

  return NextResponse.json({
    month: format(now, 'MMMM yyyy'),
    grandTotal,
    units: [
      { label: 'Toko Retail',  type: 'RETAIL',     revenue: tokoRev,       count: Number(tokoRevenue._count.id),       icon: 'shop' },
      { label: 'Restoran',     type: 'RESTAURANT',  revenue: restoRev,      count: Number(restoranRevenue._count.id),   icon: 'restaurant' },
      { label: 'Penginapan',   type: 'LODGING',     revenue: penginapanRev, count: Number(penginapanRevenue._count.id), icon: 'lodging' },
      { label: 'Homestay',     type: 'HOMESTAY',    revenue: homestayRev,   count: Number(homestayRevenue._count.id),   icon: 'homestay' },
      { label: 'Pertashop',    type: 'PERTASHOP',   revenue: pertashopRev,  count: Number(pertashopRevenue._count.id),  icon: 'fuel' },
    ],
    b2b: { revenue: Number(b2bRevenue._sum.total ?? 0), count: Number(b2bRevenue._count.id) },
    employeeCount,
    pendingBookings,
    trend: trendData,
    lowStock: lowStockRaw,
  })
}



