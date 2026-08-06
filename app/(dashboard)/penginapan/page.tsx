import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'
import { formatRupiah, formatDate } from '@/lib/utils'
import { getTonightPrice } from '@/lib/pricing'
import { startOfDay, addDays } from 'date-fns'
import Link from 'next/link'

async function getPenginapanData(tenantId: string) {
  const unit = await getTenantUnit(tenantId, 'LODGING')
  if (!unit) return null

  const now = new Date()
  const today = startOfDay(now)

  const [rooms, todayCheckIns, todayCheckOuts, upcomingBookings] = await Promise.all([
    prisma.room.findMany({
      where: { unitId: unit.id, isActive: true },
      include: {
        roomType: true,
        facilities: { include: { facility: true } },
        pricing: true,
        bookings: {
          where: { status: { in: ['CHECKED_IN', 'CONFIRMED', 'PENDING'] } },
          orderBy: { checkIn: 'asc' },
          take: 1,
        },
      },
      orderBy: [{ floor: 'asc' }, { name: 'asc' }],
    }),
    prisma.booking.findMany({
      where: { unitId: unit.id, checkIn: today, status: { in: ['CONFIRMED', 'PENDING'] } },
      include: { room: { select: { name: true } } },
    }),
    prisma.booking.findMany({
      where: { unitId: unit.id, checkOut: today, status: 'CHECKED_IN' },
      include: { room: { select: { name: true } } },
    }),
    prisma.booking.findMany({
      where: {
        unitId: unit.id,
        checkIn: { gt: today, lte: startOfDay(addDays(now, 7)) },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      include: { room: { select: { name: true } } },
      orderBy: { checkIn: 'asc' },
      take: 6,
    }),
  ])

  const occupied  = rooms.filter((r) => r.status === 'OCCUPIED').length
  const available = rooms.filter((r) => r.status === 'AVAILABLE').length
  const maint     = rooms.filter((r) => r.status === 'MAINTENANCE').length

  return { unit, rooms, occupied, available, maint, todayCheckIns, todayCheckOuts, upcomingBookings }
}

const ROOM_STATUS_STYLE: Record<string, string> = {
  AVAILABLE:   'border-green-300 bg-green-50',
  OCCUPIED:    'border-red-300 bg-red-50',
  MAINTENANCE: 'border-gray-300 bg-gray-100',
}
const ROOM_STATUS_BADGE: Record<string, string> = {
  AVAILABLE:   'bg-green-100 text-green-700',
  OCCUPIED:    'bg-red-100 text-red-700',
  MAINTENANCE: 'bg-gray-100 text-gray-500',
}
const ROOM_STATUS_LABEL: Record<string, string> = {
  AVAILABLE: 'Tersedia', OCCUPIED: 'Terisi', MAINTENANCE: 'Perbaikan',
}
const BOOKING_STATUS_BADGE: Record<string, string> = {
  PENDING:   'bg-yellow-100 text-yellow-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
}

export default async function PenginapanPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const data = await getPenginapanData(session.user.tenantId!)
  if (!data) return <p className="text-red-500">Unit Penginapan tidak ditemukan.</p>

  const { unit, rooms, occupied, available, maint, todayCheckIns, todayCheckOuts, upcomingBookings } = data

  const occupancyRate = rooms.length > 0 ? Math.round((occupied / rooms.length) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 truncate">{unit.name}</h1>
          {unit.location && <p className="text-xs md:text-sm text-gray-500 mt-0.5 truncate">{unit.location}</p>}
        </div>
        <Link
          href="/penginapan/booking/baru"
          className="flex-shrink-0 inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-3 md:px-4 py-2 md:py-2.5 rounded-lg transition-colors whitespace-nowrap"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Booking Baru
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Tingkat Hunian', value: `${occupancyRate}%`, sub: `${occupied} dari ${rooms.length} kamar`, color: occupancyRate > 70 ? 'bg-green-500' : 'bg-purple-500' },
          { label: 'Kamar Tersedia', value: available.toString(), sub: 'siap check-in', color: 'bg-green-500' },
          { label: 'Check-in Hari Ini', value: todayCheckIns.length.toString(), sub: 'tamu dijadwalkan', color: todayCheckIns.length > 0 ? 'bg-blue-500' : 'bg-gray-400' },
          { label: 'Check-out Hari Ini', value: todayCheckOuts.length.toString(), sub: 'kamar akan tersedia', color: todayCheckOuts.length > 0 ? 'bg-amber-500' : 'bg-gray-400' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 md:p-5 flex items-start gap-3">
            <div className={`w-8 h-8 md:w-10 md:h-10 ${s.color} rounded-lg flex-shrink-0 mt-0.5`} />
            <div className="min-w-0">
              <p className="text-xs text-gray-500 font-medium leading-tight">{s.label}</p>
              <p className="text-base md:text-xl font-bold text-gray-900 mt-0.5 truncate">{s.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Grid Kamar */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Status Kamar</h2>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" /> Tersedia</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /> Terisi</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-300 inline-block" /> Perbaikan</span>
            </div>
          </div>

          <div className="p-5">
            {/* Group by floor */}
            {Array.from(new Set(rooms.map((r) => r.floor))).sort().map((floor) => {
              const floorRooms = rooms.filter((r) => r.floor === floor)
              return (
                <div key={String(floor)} className="mb-5">
                  {floor !== null && (
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                      Lantai {floor}
                    </p>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {floorRooms.map((room) => {
                      const activeBooking = room.bookings[0]
                      const tonightPrice  = getTonightPrice(room.pricing)

                      return (
                        <Link
                          key={room.id}
                          href={activeBooking
                            ? `/penginapan/booking/${activeBooking.id}`
                            : `/penginapan/booking/baru?roomId=${room.id}`
                          }
                          className={`rounded-xl border-2 p-4 transition-all hover:shadow-md ${ROOM_STATUS_STYLE[room.status]}`}
                        >
                          <div className="flex items-start justify-between mb-1.5">
                            <div>
                              <p className="font-bold text-gray-900">Kamar {room.name}</p>
                              {room.roomType && (
                                <p className="text-xs text-gray-500">{room.roomType.name}</p>
                              )}
                            </div>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${ROOM_STATUS_BADGE[room.status]}`}>
                              {ROOM_STATUS_LABEL[room.status]}
                            </span>
                          </div>

                          {room.status === 'AVAILABLE' && (
                            <p className="text-sm font-semibold text-purple-600 mt-2">
                              {tonightPrice > 0 ? formatRupiah(tonightPrice) : 'Harga belum diset'}<span className="text-xs font-normal text-gray-400">/malam</span>
                            </p>
                          )}

                          {room.status === 'OCCUPIED' && activeBooking && (
                            <div className="mt-2">
                              <p className="text-xs font-semibold text-gray-800 truncate">{activeBooking.guestName}</p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                CO: {formatDate(activeBooking.checkOut)}
                              </p>
                              {Number(activeBooking.paidAmount) < Number(activeBooking.totalPrice) && (
                                <p className="text-xs text-amber-600 font-medium mt-0.5">
                                  Sisa: {formatRupiah(Number(activeBooking.totalPrice) - Number(activeBooking.paidAmount))}
                                </p>
                              )}
                            </div>
                          )}

                          {room.status === 'AVAILABLE' && activeBooking && (
                            <div className="mt-2">
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${BOOKING_STATUS_BADGE[activeBooking.status]}`}>
                                {activeBooking.status === 'CONFIRMED' ? 'Reservasi' : 'Pending'}
                              </span>
                              <p className="text-xs text-gray-500 mt-1 truncate">{activeBooking.guestName}</p>
                              <p className="text-xs text-gray-400">CI: {formatDate(activeBooking.checkIn)}</p>
                            </div>
                          )}

                          {room.status === 'MAINTENANCE' && (
                            <p className="text-xs text-gray-400 mt-2">Dalam perbaikan</p>
                          )}

                          {/* Fasilitas mini */}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {room.facilities.slice(0, 3).map((rf) => (
                              <span key={rf.facility.name} className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                {rf.facility.name}
                              </span>
                            ))}
                            {room.facilities.length > 3 && (
                              <span className="text-xs text-gray-400">+{room.facilities.length - 3}</span>
                            )}
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Kanan: Agenda hari ini + upcoming */}
        <div className="space-y-4">
          {/* Check-in hari ini */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Check-in Hari Ini</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {todayCheckIns.length === 0 && (
                <p className="px-5 py-6 text-sm text-gray-400 text-center">Tidak ada check-in hari ini</p>
              )}
              {todayCheckIns.map((b) => (
                <Link key={b.id} href={`/penginapan/booking/${b.id}`}
                  className="block px-5 py-3 hover:bg-gray-50 transition-colors">
                  <p className="text-sm font-semibold text-gray-900">{b.guestName}</p>
                  <p className="text-xs text-gray-500">Kamar {b.room.name} · {b.totalNights} malam</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${BOOKING_STATUS_BADGE[b.status]}`}>
                      {b.status}
                    </span>
                    <span className="text-xs font-semibold text-purple-600">{formatRupiah(Number(b.totalPrice))}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Check-out hari ini */}
          {todayCheckOuts.length > 0 && (
            <div className="bg-white rounded-xl border border-amber-200 shadow-sm">
              <div className="px-5 py-4 border-b border-amber-100">
                <h2 className="font-semibold text-amber-700">Check-out Hari Ini</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {todayCheckOuts.map((b) => (
                  <Link key={b.id} href={`/penginapan/booking/${b.id}`}
                    className="block px-5 py-3 hover:bg-gray-50 transition-colors">
                    <p className="text-sm font-semibold text-gray-900">{b.guestName}</p>
                    <p className="text-xs text-gray-500">Kamar {b.room.name}</p>
                    {Number(b.paidAmount) < Number(b.totalPrice) && (
                      <p className="text-xs text-red-600 font-medium mt-0.5">
                        Belum lunas: {formatRupiah(Number(b.totalPrice) - Number(b.paidAmount))}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming 7 hari */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">7 Hari ke Depan</h2>
              <Link href="/penginapan/booking" className="text-xs text-purple-600 hover:underline">
                Semua →
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {upcomingBookings.length === 0 && (
                <p className="px-5 py-6 text-sm text-gray-400 text-center">Tidak ada reservasi mendatang</p>
              )}
              {upcomingBookings.map((b) => (
                <Link key={b.id} href={`/penginapan/booking/${b.id}`}
                  className="block px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{b.guestName}</p>
                      <p className="text-xs text-gray-500">Kamar {b.room.name}</p>
                    </div>
                    <p className="text-xs text-gray-500 flex-shrink-0">{formatDate(b.checkIn)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Semua Booking', href: '/penginapan/booking', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
              { label: 'Booking Baru', href: '/penginapan/booking/baru', icon: 'M12 4v16m8-8H4' },
            ].map((nav) => (
              <Link key={nav.href} href={nav.href}
                className="bg-white border border-gray-100 shadow-sm rounded-xl p-4 flex flex-col items-center gap-2 hover:border-purple-300 hover:shadow-md transition-all group">
                <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center group-hover:bg-purple-100 transition-colors">
                  <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={nav.icon} />
                  </svg>
                </div>
                <span className="text-xs font-medium text-gray-700">{nav.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}




