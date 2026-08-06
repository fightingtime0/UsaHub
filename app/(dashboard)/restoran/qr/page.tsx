import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getTenantUnit } from '@/lib/tenant'
import { QrPrintClient } from './_components/qr-print-client'

export default async function QrPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const unit = await getTenantUnit(session.user.tenantId!, 'RESTAURANT')
  if (!unit) return <p className="text-red-500">Unit Restoran tidak ditemukan.</p>

  const tableNumbers = Array.from({ length: 12 }, (_, i) => String(i + 1))

  return <QrPrintClient tableNumbers={tableNumbers} restaurantUnitId={unit.id} />
}
