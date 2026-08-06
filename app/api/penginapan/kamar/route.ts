import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'
import { getTonightPrice } from '@/lib/pricing'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const unit = await getTenantUnit(session.user.tenantId!, 'LODGING')
  if (!unit) return NextResponse.json({ error: 'Unit tidak ditemukan' }, { status: 404 })

  const rooms = await prisma.room.findMany({
    where: { unitId: unit.id, isActive: true },
    include: {
      roomType: true,
      facilities: { include: { facility: true } },
      pricing: true,
      bookings: {
        where: { status: { in: ['CHECKED_IN', 'CONFIRMED', 'PENDING'] } },
        orderBy: { checkIn: 'asc' },
        take: 1,
        select: {
          id: true,
          bookingCode: true,
          guestName: true,
          checkIn: true,
          checkOut: true,
          status: true,
          paidAmount: true,
          totalPrice: true,
        },
      },
    },
    orderBy: [{ floor: 'asc' }, { name: 'asc' }],
  })

  const serialized = rooms.map((room) => ({
    ...room,
    tonightPrice: getTonightPrice(room.pricing),
    pricing: room.pricing.map((p) => ({ ...p, price: Number(p.price) })),
    bookings: room.bookings.map((b) => ({
      ...b,
      paidAmount: Number(b.paidAmount),
      totalPrice: Number(b.totalPrice),
    })),
    facilities: room.facilities.map((rf) => rf.facility.name),
  }))

  return NextResponse.json(serialized)
}



