import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { updateBookingStatus, serializeBooking } from '@/lib/accommodation'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const booking = await prisma.booking.findUnique({
    where: { id: id },
    include: {
      room: {
        include: {
          roomType: true,
          facilities: { include: { facility: true } },
          pricing: true,
        },
      },
      payments: { orderBy: { paidAt: 'asc' } },
      unit: { select: { tenantId: true } },
    },
  })
  if (!booking || booking.unit.tenantId !== session.user.tenantId) {
    return NextResponse.json({ error: 'Booking tidak ditemukan' }, { status: 404 })
  }

  const serialized = {
    ...serializeBooking(booking),
    room: {
      ...booking.room,
      pricing: booking.room?.pricing.map((p) => ({ ...p, price: Number(p.price) })) ?? [],
    },
  }

  return NextResponse.json(serialized)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { status } = await req.json()
    if (!status) return NextResponse.json({ error: 'Status wajib diisi' }, { status: 400 })
    const updated = await updateBookingStatus(session.user.tenantId!, id, status)
    return NextResponse.json(serializeBooking(updated))
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}



