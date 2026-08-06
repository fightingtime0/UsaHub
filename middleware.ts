import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname

    // SUPERADMIN tidak terikat tenant manapun — hanya boleh akses /superadmin,
    // tidak pernah masuk ke halaman bisnis (semua sudah dilingkupkan per tenant).
    if (token?.role === 'SUPERADMIN') {
      if (pathname.startsWith('/superadmin')) return NextResponse.next()
      return NextResponse.redirect(new URL('/superadmin', req.url))
    }
    // Sebaliknya, role tenant (OWNER/MANAGER/STAFF/CASHIER) tidak boleh masuk /superadmin.
    if (pathname.startsWith('/superadmin')) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    // OWNER bisa akses semua unit dalam tenant-nya sendiri
    if (token?.role === 'OWNER') return NextResponse.next()

    // Guard per modul berdasarkan primaryUnitType
    const unitRouteMap: Record<string, string[]> = {
      RETAIL:     ['/toko'],
      HOMESTAY:   ['/homestay'],
      RESTAURANT: ['/restoran'],
      LODGING:    ['/penginapan'],
      PERTASHOP:  ['/pertashop'],
    }

    const unitType = token?.primaryUnitType as string | null
    const allowedRoutes = unitType ? unitRouteMap[unitType] ?? [] : []

    // Dashboard utama boleh untuk semua yang sudah login
    if (pathname === '/dashboard') return NextResponse.next()

    // SDM, laporan, dan B2B hanya OWNER dan MANAGER
    if (pathname.startsWith('/sdm') || pathname.startsWith('/laporan') || pathname.startsWith('/b2b')) {
      if (token?.role === 'MANAGER') return NextResponse.next()
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    const isAllowed = allowedRoutes.some((route) => pathname.startsWith(route))
    if (!isAllowed) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
)

export const config = {
  matcher: ['/dashboard/:path*', '/toko/:path*', '/homestay/:path*', '/restoran/:path*', '/penginapan/:path*', '/pertashop/:path*', '/b2b/:path*', '/sdm/:path*', '/laporan/:path*', '/superadmin/:path*'],
}
