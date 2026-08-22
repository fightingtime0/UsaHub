import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'
import { PaketClient } from './_components/paket-client'

export default async function KopiTeloPaketPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const unit = await getTenantUnit(session.user.tenantId!, 'KOPI_TELO')
  if (!unit) return <p className="text-red-500">Unit Kopi Telo tidak ditemukan.</p>

  const paket = await prisma.menuItem.findMany({
    where: { unitId: unit.id },
    orderBy: { price: 'asc' },
    select: { id: true, name: true, description: true, price: true, isAvailable: true },
  })

  return (
    <PaketClient
      canEdit={session.user.role === 'OWNER' || session.user.role === 'MANAGER'}
      paket={paket.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: Number(p.price),
        isAvailable: p.isAvailable,
      }))}
    />
  )
}
