import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { resolveNightlyPricing } from '@/lib/pricing'
import { BookingDetailClient } from './_components/booking-detail-client'

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const booking = await prisma.booking.findUnique({
    where: { id: (await params).id },
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

  if (!booking || booking.unit.tenantId !== session.user.tenantId) redirect('/penginapan')

  const breakdown = resolveNightlyPricing(
    booking.checkIn,
    booking.checkOut,
    booking.room.pricing
  )

  return (
    <BookingDetailClient
      booking={{
        id: booking.id,
        bookingCode: booking.bookingCode,
        guestName: booking.guestName,
        guestPhone: booking.guestPhone,
        guestEmail: booking.guestEmail,
        guestIdNum: booking.guestIdNum,
        checkIn: booking.checkIn.toISOString(),
        checkOut: booking.checkOut.toISOString(),
        totalNights: booking.totalNights,
        pricePerNight: Number(booking.pricePerNight),
        totalPrice: Number(booking.totalPrice),
        dpAmount: Number(booking.dpAmount),
        paidAmount: Number(booking.paidAmount),
        extraBed: booking.extraBed,
        extraBedPrice: Number(booking.extraBedPrice),
        status: booking.status,
        source: booking.source,
        note: booking.note,
        createdAt: booking.createdAt.toISOString(),
        room: {
          id: booking.room.id,
          name: booking.room.name,
          floor: booking.room.floor,
          roomType: booking.room.roomType ? { name: booking.room.roomType.name } : null,
          facilities: booking.room.facilities.map((rf) => rf.facility.name),
        },
        payments: booking.payments.map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          method: p.method,
          type: p.type,
          note: p.note,
          paidAt: p.paidAt.toISOString(),
        })),
      }}
      breakdown={breakdown}
    />
  )
}





