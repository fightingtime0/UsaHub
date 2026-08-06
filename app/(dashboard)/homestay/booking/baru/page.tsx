import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'
import { HomestayBookingFormClient } from './_components/booking-form-client'

export default async function BookingBaruPage({
  searchParams,
}: {
  searchParams: { roomId?: string }
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  const unit = await getTenantUnit(session.user.tenantId!, 'HOMESTAY')
  if (!unit) return <p className="p-6 text-gray-500">Unit Homestay tidak ditemukan.</p>

  const rooms = await prisma.room.findMany({
    where: { unitId: unit.id, isActive: true },
    include: {
      roomType: true,
      facilities: { include: { facility: true } },
      pricing: true,
    },
    orderBy: { name: 'asc' },
  })

  const serialized = rooms.map((r) => ({
    ...r,
    pricing: r.pricing.map((p) => ({ ...p, price: Number(p.price) })),
  }))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Booking Baru</h1>
        <p className="text-sm text-gray-500 mt-0.5">Homestay · {unit.name}</p>
      </div>
      <HomestayBookingFormClient
        rooms={serialized as any}
        defaultRoomId={searchParams.roomId ?? ''}
      />
    </div>
  )
}



