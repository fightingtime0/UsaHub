import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'
import { RombonganClient } from './_components/rombongan-client'

export default async function RombonganPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const unit = await getTenantUnit(session.user.tenantId!, 'RESTAURANT')
  if (!unit) return <p className="text-red-500">Unit Restoran tidak ditemukan.</p>

  const orders = await prisma.groupOrder.findMany({
    where: { unitId: unit.id },
    orderBy: [{ eventDate: 'desc' }],
    take: 100,
  })

  return (
    <RombonganClient
      orders={orders.map((o) => ({
        id: o.id,
        orderCode: o.orderCode,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        eventDate: o.eventDate.toISOString(),
        pax: o.pax,
        menuType: o.menuType,
        customMenu: o.customMenu,
        pricePerPax: Number(o.pricePerPax),
        totalPrice: Number(o.totalPrice),
        dpAmount: Number(o.dpAmount),
        paidAmount: Number(o.paidAmount),
        status: o.status,
        note: o.note,
      }))}
    />
  )
}
