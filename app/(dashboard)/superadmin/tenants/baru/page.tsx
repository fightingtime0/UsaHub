import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { CreateTenantClient } from './_components/create-tenant-client'

export default async function TenantBaruPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.user.role !== 'SUPERADMIN') redirect('/dashboard')

  return <CreateTenantClient />
}
