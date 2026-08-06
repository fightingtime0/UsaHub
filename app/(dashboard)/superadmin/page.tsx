import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

export default async function SuperadminPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.user.role !== 'SUPERADMIN') redirect('/dashboard')

  const tenants = await prisma.tenant.findMany({
    include: { _count: { select: { businessUnits: true, users: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Tenant</h1>
          <p className="text-xs md:text-sm text-gray-500 mt-0.5">Kelola bisnis (tenant) yang berjalan di atas platform ini</p>
        </div>
        <Link
          href="/superadmin/tenants/baru"
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors whitespace-nowrap"
        >
          + Tenant Baru
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="divide-y divide-gray-50">
          {tenants.length === 0 && (
            <p className="px-5 py-8 text-sm text-gray-400 text-center">Belum ada tenant. Buat tenant pertama untuk mulai.</p>
          )}
          {tenants.map((t) => (
            <Link
              key={t.id}
              href={`/superadmin/tenants/${t.id}`}
              className="px-4 md:px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900 truncate">{t.name}</p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                      t.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {t.isActive ? 'Aktif' : 'Suspend'}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  /{t.slug} · dibuat {formatDate(t.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0 text-right">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{t._count.businessUnits}</p>
                  <p className="text-xs text-gray-400">unit</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{t._count.users}</p>
                  <p className="text-xs text-gray-400">user</p>
                </div>
                <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
