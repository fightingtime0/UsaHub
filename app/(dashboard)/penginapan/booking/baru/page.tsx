import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'
import { getTonightPrice } from '@/lib/pricing'
import { BookingFormClient } from './_components/booking-form-client'

export default async function BookingBaruPage({
  searchParams,
}: {
  searchParams: { roomId?: string }
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  const unit = await getTenantUnit(session.user.tenantId!, 'LODGING')
  if (!unit) return <p>Unit tidak ditemukan.</p>

  const rooms = await prisma.room.findMany({
    where: { unitId: unit.id, isActive: true },
    include: {
      roomType: true,
      pricing: true,
      facilities: { include: { facility: true } },
    },
    orderBy: [{ floor: 'asc' }, { name: 'asc' }],
  })

  const serialized = rooms.map((r) => ({
    id: r.id,
    name: r.name,
    floor: r.floor,
    status: r.status,
    roomType: r.roomType ? { name: r.roomType.name } : null,
    facilities: r.facilities.map((rf) => rf.facility.name),
    tonightPrice: getTonightPrice(r.pricing),
    pricing: r.pricing.map((p) => ({
      id: p.id,
      dayType: p.dayType,
      price: Number(p.price),
      startDate: p.startDate?.toISOString() ?? null,
      endDate: p.endDate?.toISOString() ?? null,
      label: p.label,
      isActive: p.isActive,
    })),
  }))

  return (
    <BookingFormClient
      rooms={serialized as any}
      preselectedRoomId={searchParams.roomId ?? null}
    />
  )
}



