import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getRooms } from '@/lib/accommodation'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rooms = await getRooms(session.user.tenantId!, 'HOMESTAY')
  if (!rooms) return NextResponse.json({ error: 'Unit tidak ditemukan' }, { status: 404 })

  const serialized = rooms.map((r) => ({
    ...r,
    pricing: r.pricing.map((p) => ({ ...p, price: Number(p.price) })),
    bookings: r.bookings.map((b) => ({
      ...b,
      totalPrice: Number(b.totalPrice),
      paidAmount: Number(b.paidAmount),
    })),
  }))

  return NextResponse.json(serialized)
}



