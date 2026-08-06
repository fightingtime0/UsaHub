import { getSession } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { TenantDetailClient } from './_components/tenant-detail-client'

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.user.role !== 'SUPERADMIN') redirect('/dashboard')

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      businessUnits: { orderBy: { type: 'asc' } },
      users: { select: { id: true, name: true, email: true, role: true, isActive: true }, orderBy: { name: 'asc' } },
    },
  })
  if (!tenant) notFound()

  return (
    <TenantDetailClient
      tenant={{
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        isActive: tenant.isActive,
      }}
      businessUnits={tenant.businessUnits.map((u) => ({
        id: u.id,
        name: u.name,
        type: u.type,
        isActive: u.isActive,
      }))}
      users={tenant.users}
    />
  )
}
