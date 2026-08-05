'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import type { Role } from '@prisma/client'

type NavItem = {
  label: string
  href: string
  icon: React.ReactNode
  roles?: Role[]
  unitTypes?: string[]
}

const Icon = ({ d }: { d: string }) => (
  <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
)

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Overview',
    href: '/dashboard',
    icon: <Icon d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
    roles: ['OWNER'],
  },
  {
    label: 'Toko Retail',
    href: '/toko',
    icon: <Icon d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />,
    roles: ['OWNER', 'MANAGER', 'STAFF', 'CASHIER'],
    unitTypes: ['RETAIL'],
  },
  {
    label: 'Homestay',
    href: '/homestay',
    icon: <Icon d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10" />,
    roles: ['OWNER', 'MANAGER', 'STAFF', 'CASHIER'],
    unitTypes: ['HOMESTAY'],
  },
  {
    label: 'Restoran',
    href: '/restoran',
    icon: <Icon d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />,
    roles: ['OWNER', 'MANAGER', 'STAFF', 'CASHIER'],
    unitTypes: ['RESTAURANT'],
  },
  {
    label: 'Penginapan',
    href: '/penginapan',
    icon: <Icon d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />,
    roles: ['OWNER', 'MANAGER', 'STAFF', 'CASHIER'],
    unitTypes: ['LODGING'],
  },
  {
    label: 'Pertashop',
    href: '/pertashop',
    icon: <Icon d="M3 21h10M5 21V5a2 2 0 012-2h2a2 2 0 012 2v16M13 9h2a2 2 0 012 2v6a1.5 1.5 0 003 0V9l-2.5-2.5M6.5 7h3" />,
    roles: ['OWNER', 'MANAGER', 'STAFF', 'CASHIER'],
    unitTypes: ['PERTASHOP'],
  },
  {
    label: 'B2B Invoice',
    href: '/b2b',
    icon: <Icon d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
    roles: ['OWNER', 'MANAGER'],
  },
  {
    label: 'SDM',
    href: '/sdm',
    icon: <Icon d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />,
    roles: ['OWNER', 'MANAGER'],
  },
  {
    label: 'Laporan',
    href: '/laporan',
    icon: <Icon d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
    roles: ['OWNER', 'MANAGER'],
  },
  {
    label: 'Akun Saya',
    href: '/akun',
    icon: <Icon d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
  },
]

function filterNavItems(role: Role, unitType: string | null): NavItem[] {
  return NAV_ITEMS.filter((item) => {
    const roleOk = !item.roles || item.roles.includes(role)
    if (!roleOk) return false
    if (role === 'OWNER') return true
    if (!item.unitTypes) return true
    return unitType ? item.unitTypes.includes(unitType) : false
  })
}

const ROLE_LABEL: Record<Role, string> = {
  OWNER:   'Owner',
  MANAGER: 'Manager',
  STAFF:   'Staff',
  CASHIER: 'Kasir',
}

type SidebarProps = {
  user: {
    name: string
    email: string
    role: Role
    primaryUnitType: string | null
  }
  /** Apakah sidebar terbuka di mobile (diatur dari DashboardShell) */
  isMobileOpen?: boolean
  /** Callback untuk menutup sidebar di mobile */
  onClose?: () => void
}

export function Sidebar({ user, isMobileOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname()
  const navItems = filterNavItems(user.role, user.primaryUnitType)

  // Saat item nav diklik di mobile → tutup sidebar
  function handleNavClick() {
    onClose?.()
  }

  return (
    <>
      {/*
       * Desktop: posisi normal dalam flex row (w-64, selalu terlihat)
       * Mobile:  fixed overlay, translate keluar saat tertutup, masuk saat terbuka
       */}
      <aside
        className={[
          // Dasar
          'w-64 bg-gray-900 text-white flex flex-col flex-shrink-0',
          // Mobile: fixed, z di atas overlay (z-30), animasi slide
          'fixed inset-y-0 left-0 z-30 transition-transform duration-300 ease-in-out',
          // Desktop: lepas dari fixed, ikut flow normal
          'md:relative md:translate-x-0 md:z-auto md:transition-none',
          // State mobile: terbuka atau tertutup
          isMobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {/* Brand */}
        <div className="px-6 py-5 border-b border-gray-700 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-0.5">Bisnis Terpadu</p>
            <p className="text-white font-bold text-lg leading-tight">ADSjetis</p>
          </div>
          {/* Tombol tutup — hanya mobile */}
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            aria-label="Tutup menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleNavClick}
                className={[
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sky-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white active:bg-gray-700',
                ].join(' ')}
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* User info + logout */}
        <div className="px-4 py-4 border-t border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-sky-600 flex items-center justify-center text-sm font-bold flex-shrink-0 select-none">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.name}</p>
              <p className="text-xs text-gray-400">{ROLE_LABEL[user.role]}</p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Keluar
          </button>
        </div>
      </aside>
    </>
  )
}
