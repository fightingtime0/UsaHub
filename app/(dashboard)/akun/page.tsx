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

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-5">
        <h2 className="font-semibold text-gray-900 text-sm md:text-base mb-4">Profil</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Nama</dt>
            <dd className="font-medium text-gray-900 text-right">{user.name}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Email</dt>
            <dd className="font-medium text-gray-900 text-right">{user.email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Role</dt>
            <dd className="font-medium text-gray-900 text-right">{ROLE_LABEL[user.role] ?? user.role}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Unit</dt>
            <dd className="font-medium text-gray-900 text-right">{user.primaryUnit?.name ?? 'Semua unit (Owner)'}</dd>
          </div>
        </dl>
      </div>

      <AkunClient />
    </div>
  )
}
