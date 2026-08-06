'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Role } from '@prisma/client'

type NavItem = { label: string; href: string; roles: Role[] }

const ITEMS: NavItem[] = [
  { label: 'Ringkasan', href: '/pertashop', roles: ['OWNER', 'MANAGER', 'STAFF'] },
  { label: 'Input Stok Awal', href: '/pertashop/stok', roles: ['OWNER', 'MANAGER', 'STAFF'] },
  { label: 'Input Penjualan', href: '/pertashop/penjualan', roles: ['OWNER', 'MANAGER', 'STAFF'] },
  { label: 'Input Belanja', href: '/pertashop/belanja', roles: ['OWNER', 'MANAGER', 'STAFF'] },
  { label: 'Semua Transaksi', href: '/pertashop/transaksi', roles: ['OWNER', 'MANAGER'] },
  { label: 'Rekonsiliasi', href: '/pertashop/rekonsiliasi', roles: ['OWNER', 'MANAGER'] },
  { label: 'Laporan Laba/Rugi', href: '/pertashop/laporan', roles: ['OWNER'] },
]

export function PertashopSubnav({ role }: { role: Role }) {
  const pathname = usePathname()
  const items = ITEMS.filter((item) => item.roles.includes(role))

  return (
    <div className="-mx-4 md:mx-0 mb-5 overflow-x-auto">
      <nav className="flex gap-1.5 px-4 md:px-0 min-w-max">
        {items.map((item) => {
          const isActive = item.href === '/pertashop' ? pathname === '/pertashop' : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium whitespace-nowrap transition-colors ${
                isActive ? 'bg-emerald-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
