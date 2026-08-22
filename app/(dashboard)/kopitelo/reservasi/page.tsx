import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'
import { ReservasiClient } from './_components/reservasi-client'

export default async function KopiTeloReservasiPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const unit = await getTenantUnit(session.user.tenantId!, 'KOPI_TELO')
  if (!unit) return <p className="text-red-500">Unit Kopi Telo tidak ditemukan.</p>

  const [reservasi, paket] = await Promise.all([
    prisma.groupOrder.findMany({
      where: { unitId: unit.id },
      orderBy: { eventDate: 'desc' },
      take: 100,
    }),
    prisma.menuItem.findMany({
      where: { unitId: unit.id, isAvailable: true },
      orderBy: { price: 'asc' },
      select: { id: true, name: true, price: true },
    }),
  ])

  return (
    <ReservasiClient
      unitName={unit.name}
      paket={paket.map((p) => ({ id: p.id, name: p.name, price: Number(p.price) }))}
      reservasi={reservasi.map((r) => ({
        id: r.id,
        orderCode: r.orderCode,
        travelName: r.travelName,
        customerName: r.customerName,
        customerPhone: r.customerPhone,
        busPo: r.busPo,
        source: r.source,
        eventDate: r.eventDate.toISOString(),
        pax: r.pax,
        menuType: r.menuType,
        customMenu: r.customMenu,
        pricePerPax: Number(r.pricePerPax),
        totalPrice: Number(r.totalPrice),
        paidAmount: Number(r.paidAmount),
        status: r.status,
        note: r.note,
      }))}
    />
  )
}
