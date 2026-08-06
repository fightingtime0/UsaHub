import { getSession } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { serializeBooking } from '@/lib/accommodation'
import { HomestayBookingDetailClient } from './_components/booking-detail-client'

export default async function HomestayBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
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
    },
  })

  if (!booking) notFound()

  // Verify this booking belongs to a HOMESTAY unit within the caller's tenant
  const unit = await prisma.businessUnit.findUnique({ where: { id: booking.unitId } })
  if (!unit || unit.type !== 'HOMESTAY' || unit.tenantId !== session.user.tenantId) notFound()

  const serialized = {
    ...serializeBooking(booking),
    room: {
      ...booking.room,
      pricing: booking.room?.pricing.map((p) => ({ ...p, price: Number(p.price) })) ?? [],
      facilities: booking.room?.facilities ?? [],
    },
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <a href="/homestay/booking" className="text-sm text-gray-500 hover:text-teal-600">
          ← Semua Booking
        </a>
        <span className="text-gray-300">/</span>
        <p className="text-sm font-medium text-gray-700">{booking.bookingCode}</p>
      </div>
      <HomestayBookingDetailClient booking={serialized} role={session.user.role} />
    </div>
  )
}





