import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'
import { startOfDay, endOfDay, startOfMonth, endOfMonth, addDays } from 'date-fns'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const unit = await getTenantUnit(session.user.tenantId!, 'LODGING')
  if (!unit) return NextResponse.json({ error: 'Unit tidak ditemukan' }, { status: 404 })

  const now = new Date()
  const today = startOfDay(now)
  const tomorrow = startOfDay(addDays(now, 1))

  const [
    totalRooms,
    occupiedRooms,
    monthRevenue,
    todayCheckIns,
    todayCheckOuts,
    upcomingBookings,
  ] = await Promise.all([
    prisma.room.count({ where: { unitId: unit.id, isActive: true } }),

    prisma.room.count({ where: { unitId: unit.id, status: 'OCCUPIED' } }),

    prisma.booking.aggregate({
      where: {
        unitId: unit.id,
        status: { in: ['CHECKED_OUT'] },
        checkOut: { gte: startOfMonth(now), lte: endOfMonth(now) },
      },
      _sum: { totalPrice: true },
    }),

    // Check-in hari ini
    prisma.booking.findMany({
      where: {
        unitId: unit.id,
        checkIn: today,
        status: { in: ['CONFIRMED', 'PENDING'] },
      },
      include: { room: { select: { name: true } } },
      orderBy: { checkIn: 'asc' },
    }),

    // Check-out hari ini
    prisma.booking.findMany({
      where: {
        unitId: unit.id,
        checkOut: today,
        status: 'CHECKED_IN',
      },
      include: { room: { select: { name: true } } },
    }),

    // Booking 7 hari ke depan (CONFIRMED)
    prisma.booking.findMany({
      where: {
        unitId: unit.id,
        checkIn: { gte: tomorrow, lte: startOfDay(addDays(now, 7)) },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      include: { room: { select: { name: true } } },
      orderBy: { checkIn: 'asc' },
      take: 5,
    }),
  ])

  const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0

  return NextResponse.json({
    unitId: unit.id,
    unitName: unit.name,
    totalRooms,
    occupiedRooms,
    occupancyRate,
    monthRevenue: Number(monthRevenue._sum.totalPrice ?? 0),
    todayCheckIns,
    todayCheckOuts,
    upcomingBookings,
  })
}



