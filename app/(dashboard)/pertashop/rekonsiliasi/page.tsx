import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'
import { RekonsiliasiClient } from './_components/rekonsiliasi-client'

export default async function RekonsiliasiPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!['OWNER', 'MANAGER'].includes(session.user.role)) redirect('/pertashop')

  const unit = await getTenantUnit(session.user.tenantId!, 'PERTASHOP')
  if (!unit) return <p className="text-red-500">Unit Pertashop tidak ditemukan.</p>

  const recons = await prisma.fuelReconciliation.findMany({
    where: { unitId: unit.id },
    orderBy: { date: 'desc' },
    take: 60,
  })

  return (
    <RekonsiliasiClient
      recons={recons.map((r) => ({
        id: r.id,
        date: r.date.toISOString(),
        reportedSales: Number(r.reportedSales),
        expenseAmount: Number(r.expenseAmount),
        depositAmount: Number(r.depositAmount),
        difference: Number(r.difference),
        note: r.note,
      }))}
    />
  )
}
