import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createBooking, serializeBooking } from '@/lib/accommodation'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const unit = await getTenantUnit(session.user.tenantId!, 'HOMESTAY')
  if (!unit) return NextResponse.json({ error: 'Unit tidak ditemukan' }, { status: 404 })

  const { searchParams } = req.nextUrl
  const status = searchParams.get('status')
  const page   = parseInt(searchParams.get('page') ?? '1')
  const limit  = 25

  const where = { unitId: unit.id, ...(status ? { status: status as any } : {}) }

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: {
        room: { select: { name: true, floor: true, roomType: { select: { name: true } } } },
        payments: true,
      },
      orderBy: { checkIn: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.booking.count({ where }),
  ])

  return NextResponse.json({
    bookings: bookings.map(serializeBooking),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { booking, breakdown } = await createBooking(session.user.tenantId!, 'HOMESTAY', body)
    return NextResponse.json({ booking: serializeBooking(booking), breakdown }, { status: 201 })
  } catch (err: any) {
    const status = err.message.includes('konflik') || err.message.includes('aktif') ? 409 : 400
    return NextResponse.json({ error: err.message }, { status })
  }
}



