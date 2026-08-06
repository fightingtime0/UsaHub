'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from './sidebar'
import type { Role, UnitType } from '@prisma/client'

type User = {
  name: string
  email: string
  role: Role
  primaryUnitType: string | null
}

export function DashboardShell({
  user,
  siteName,
  units,
  children,
}: {
  user: User
  siteName: string
  units: { type: UnitType; name: string }[]
  children: React.ReactNode
}) {
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const pathname = usePathname()

  // Auto-close sidebar saat navigasi berubah
  useEffect(() => {
    setIsMobileOpen(false)
  }, [pathname])

  // Lock body scroll saat sidebar overlay terbuka di mobile
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobileOpen])

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Overlay gelap — hanya mobile, saat sidebar terbuka */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — dikontrol dari sini */}
      <Sidebar
        user={user}
        siteName={siteName}
        units={units}
        isMobileOpen={isMobileOpen}
        onClose={() => setIsMobileOpen(false)}
      />

      {/* Kolom konten utama */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* ─── Mobile top bar ─────────────────── */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0 z-10">
          <button
            onClick={() => setIsMobileOpen(true)}
            className="p-2 -ml-1 rounded-lg text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors"
            aria-label="Buka menu navigasi"
          >
            {/* Hamburger icon */}
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Brand name singkat */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{siteName}</p>
          </div>

          {/* Avatar mini — klik tidak perlu action, hanya visual */}
          <div className="w-8 h-8 rounded-full bg-sky-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            {user.name.charAt(0).toUpperCase()}
          </div>
        </header>

        {/* Konten halaman */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
