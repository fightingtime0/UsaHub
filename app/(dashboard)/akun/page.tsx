import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { AkunClient } from './_components/akun-client'

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  STAFF: 'Staff',
  CASHIER: 'Kasir',
}

export default async function AkunPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      role: true,
      createdAt: true,
      primaryUnit: { select: { name: true, type: true } },
    },
  })
  if (!user) redirect('/login')

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Akun Saya</h1>
        <p className="text-xs md:text-sm text-gray-500 mt-0.5">Profil dan pengaturan akun Anda</p>
      </div>

      <AkunClient
        name={user.name}
        email={user.email}
        role={user.role}
        roleLabel={ROLE_LABEL[user.role] ?? user.role}
        unitName={user.primaryUnit?.name ?? 'Semua unit (Owner)'}
      />
    </div>
  )
}
