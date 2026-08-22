import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getTenantUnit } from '@/lib/tenant'
import { LinkClient } from './_components/link-client'

export default async function KopiTeloLinkPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const unit = await getTenantUnit(session.user.tenantId!, 'KOPI_TELO')
  if (!unit) return <p className="text-red-500">Unit Kopi Telo tidak ditemukan.</p>

  return <LinkClient unitId={unit.id} unitName={unit.name} operatorPhone={unit.phone} />
}
