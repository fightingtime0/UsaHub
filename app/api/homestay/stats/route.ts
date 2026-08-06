import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'
import { startOfDay, endOfDay, startOfMonth, endOfMonth, addDays } from 'date-fns'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const unit = await getTenantUnit(session.user.tenantId!, 'HOMESTAY')
  if (!unit) return NextResponse.json({ error: 'Unit tidak ditemukan' }, { status: 404 })

  const now   = new Date()
  const today = startOfDay(now)
  const todayEnd = endOfDay(now)
  const mStart = startOfMonth(now)
  const mEnd   = endOfMonth(now)
  const next7  = addDays(today, 7)

  const [
    totalRooms,
    occupiedRooms,
    checkInsToday,
    checkOutsToday,
    revenueThisMonth,
    upcomingBookings,
    pendingConfirm,
    recentBookings,
  ] = await Promise.all([
    prisma.room.count({ where: { unitId: unit.id, isActive: true } }),
    prisma.room.count({ where: { unitId: unit.id, status: 'OCCUPIED' } }),
    prisma.booking.count({
      where: { unitId: unit.id, status: { in: ['CONFIRMED', 'CHECKED_IN'] }, checkIn: { gte: today, lte: todayEnd } },
    }),
    prisma.booking.count({
      where: { unitId: unit.id, status: 'CHECKED_IN', checkOut: { gte: today, lte: todayEnd } },
    }),
    prisma.booking.aggregate({
      where: { unitId: unit.id, status: { in: ['CHECKED_IN', 'CHECKED_OUT'] }, checkIn: { gte: mStart, lte: mEnd } },
      _sum: { totalPrice: true },
    }),
    prisma.booking.count({
      where: { unitId: unit.id, status: { in: ['CONFIRMED', 'PENDING'] }, checkIn: { gt: today, lte: next7 } },
    }),
    prisma.booking.count({ where: { unitId: unit.id, status: 'PENDING' } }),
    prisma.booking.findMany({
      where: { unitId: unit.id },
      include: { room: { select: { name: true, roomType: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

  return NextResponse.json({
    totalRooms,
    occupiedRooms,
    availableRooms: totalRooms - occupiedRooms,
    occupancyRate: totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0,
    checkInsToday,
    checkOutsToday,
    revenueThisMonth: Number(revenueThisMonth._sum.totalPrice ?? 0),
    upcomingBookings,
    pendingConfirm,
    recentBookings: recentBookings.map((b) => ({
      ...b,
      totalPrice: Number(b.totalPrice),
      paidAmount: Number(b.paidAmount),
      dpAmount:   Number(b.dpAmount),
    })),
  })
}



