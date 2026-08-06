import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'
import { formatRupiah, formatDate } from '@/lib/utils'
import { startOfDay, endOfDay, addDays, startOfMonth, endOfMonth } from 'date-fns'
import Link from 'next/link'
import { getTonightPrice } from '@/lib/pricing'

const STATUS_BADGE: Record<string, string> = {
  AVAILABLE:   'bg-emerald-100 text-emerald-700',
  OCCUPIED:    'bg-rose-100 text-rose-700',
  CLEANING:    'bg-amber-100 text-amber-700',
  MAINTENANCE: 'bg-gray-100 text-gray-500',
}
const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: 'Tersedia', OCCUPIED: 'Terisi', CLEANING: 'Cleaning', MAINTENANCE: 'Perbaikan',
}

export default async function HomestayPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const unit = await getTenantUnit(session.user.tenantId!, 'HOMESTAY')
  if (!unit) return <p className="p-6 text-gray-500">Unit Homestay tidak ditemukan.</p>

  const now      = new Date()
  const today    = startOfDay(now)
  const todayEnd = endOfDay(now)
  const next7    = addDays(today, 7)
  const mStart   = startOfMonth(now)
  const mEnd     = endOfMonth(now)

  const [rooms, checkInsToday, checkOutsToday, revenueMonth, upcomingBookings] = await Promise.all([
    prisma.room.findMany({
      where: { unitId: unit.id, isActive: true },
      include: {
        roomType: true,
        facilities: { include: { facility: true }, orderBy: { facility: { name: 'asc' } } },
        pricing: true,
        bookings: {
          where: { status: { in: ['CHECKED_IN', 'CONFIRMED', 'PENDING'] } },
          orderBy: { checkIn: 'asc' },
          take: 2,
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.booking.findMany({
      where: { unitId: unit.id, status: { in: ['CONFIRMED', 'CHECKED_IN'] }, checkIn: { gte: today, lte: todayEnd } },
      include: { room: { select: { name: true, roomType: { select: { name: true } } } } },
      orderBy: { checkIn: 'asc' },
    }),
    prisma.booking.findMany({
      where: { unitId: unit.id, status: 'CHECKED_IN', checkOut: { gte: today, lte: todayEnd } },
      include: { room: { select: { name: true, roomType: { select: { name: true } } } } },
      orderBy: { checkOut: 'asc' },
    }),
    prisma.booking.aggregate({
      where: { unitId: unit.id, status: { in: ['CHECKED_IN', 'CHECKED_OUT'] }, checkIn: { gte: mStart, lte: mEnd } },
      _sum: { totalPrice: true },
    }),
    prisma.booking.findMany({
      where: { unitId: unit.id, status: { in: ['CONFIRMED', 'PENDING'] }, checkIn: { gt: today, lte: next7 } },
      include: { room: { select: { name: true } } },
      orderBy: { checkIn: 'asc' },
    }),
  ])

  const totalRooms    = rooms.length
  const occupiedRooms = rooms.filter((r) => r.status === 'OCCUPIED').length
  const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 truncate">Homestay</h1>
          <p className="text-xs md:text-sm text-gray-500 mt-0.5 truncate">{unit.name}</p>
        </div>
        <Link href="/homestay/booking/baru"
          className="flex-shrink-0 inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-3 md:px-4 py-2 md:py-2.5 rounded-xl transition-colors shadow-sm whitespace-nowrap">
          + Booking Baru
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Tingkat Hunian', value: `${occupancyRate}%`, sub: `${occupiedRooms}/${totalRooms} villa`, color: 'text-teal-600' },
          { label: 'Tersedia', value: String(totalRooms - occupiedRooms), sub: 'villa siap', color: 'text-emerald-600' },
          { label: 'Check-in Hari Ini', value: String(checkInsToday.length), sub: 'tamu masuk', color: 'text-blue-600' },
          { label: 'Check-out Hari Ini', value: String(checkOutsToday.length), sub: 'tamu keluar', color: 'text-orange-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-3 md:px-5 py-3 md:py-4">
            <p className="text-xs text-gray-500 font-medium leading-tight">{s.label}</p>
            <p className={`text-xl md:text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Revenue Banner */}
      <div className="bg-gradient-to-r from-teal-600 to-emerald-600 rounded-xl px-4 md:px-6 py-4 text-white flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm opacity-80">Pendapatan Bulan Ini</p>
          <p className="text-2xl md:text-3xl font-bold mt-0.5 truncate">{formatRupiah(Number(revenueMonth._sum.totalPrice ?? 0))}</p>
        </div>
        <Link href="/homestay/booking"
          className="flex-shrink-0 text-sm bg-white/20 hover:bg-white/30 px-3 md:px-4 py-2 rounded-lg transition-colors whitespace-nowrap">
          Lihat Booking →
        </Link>
      </div>

      {/* Villa Grid */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-4">Status Villa</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {rooms.map((room) => {
            const activeBooking = room.bookings.find((b) => b.status === 'CHECKED_IN')
              ?? room.bookings.find((b) => b.status === 'CONFIRMED')
              ?? room.bookings[0]
            const tonightPrice  = getTonightPrice(room.pricing)
            const facilityNames = room.facilities.map((f) => f.facility.name)

            return (
              <VillaCard
                key={room.id}
                room={{ id: room.id, name: room.name, status: room.status, capacity: room.roomType?.capacity ?? null, roomType: room.roomType }}
                activeBooking={activeBooking ? {
                  id:         activeBooking.id,
                  guestName:  activeBooking.guestName,
                  checkIn:    activeBooking.checkIn,
                  checkOut:   activeBooking.checkOut,
                  status:     activeBooking.status,
                  totalPrice: Number(activeBooking.totalPrice),
                  paidAmount: Number(activeBooking.paidAmount),
                } : undefined}
                tonightPrice={tonightPrice}
                facilityNames={facilityNames}
              />
            )
          })}
          {rooms.length === 0 && (
            <p className="text-sm text-gray-400 col-span-full text-center py-8">Belum ada villa terdaftar.</p>
          )}
        </div>
      </div>

      {/* Agenda bawah */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Check-in */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
            Check-in Hari Ini ({checkInsToday.length})
          </h3>
          {checkInsToday.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">Tidak ada check-in hari ini</p>
          ) : (
            <div className="space-y-2">
              {checkInsToday.map((b) => (
                <Link key={b.id} href={`/homestay/booking/${b.id}`}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 border border-gray-50 group">
                  <div>
                    <p className="text-sm font-medium text-gray-900 group-hover:text-teal-600">{b.guestName}</p>
                    <p className="text-xs text-gray-400">{b.room.name}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    b.status === 'CHECKED_IN' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {b.status === 'CHECKED_IN' ? 'Sudah CI' : 'Menunggu'}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Check-out */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
            Check-out Hari Ini ({checkOutsToday.length})
          </h3>
          {checkOutsToday.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">Tidak ada check-out hari ini</p>
          ) : (
            <div className="space-y-2">
              {checkOutsToday.map((b) => {
                const remaining = Number(b.totalPrice) - Number(b.paidAmount)
                return (
                  <Link key={b.id} href={`/homestay/booking/${b.id}`}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 border border-gray-50 group">
                    <div>
                      <p className="text-sm font-medium text-gray-900 group-hover:text-teal-600">{b.guestName}</p>
                      <p className="text-xs text-gray-400">{b.room.name}</p>
                    </div>
                    {remaining > 0 ? (
                      <span className="text-xs font-semibold text-red-600">{formatRupiah(remaining)}</span>
                    ) : (
                      <span className="text-xs font-medium text-green-600">Lunas</span>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Upcoming 7 hari */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
            Akan Datang 7 Hari ({upcomingBookings.length})
          </h3>
          {upcomingBookings.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">Tidak ada booking mendatang</p>
          ) : (
            <div className="space-y-2">
              {upcomingBookings.map((b) => (
                <Link key={b.id} href={`/homestay/booking/${b.id}`}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 border border-gray-50 group">
                  <div>
                    <p className="text-sm font-medium text-gray-900 group-hover:text-teal-600">{b.guestName}</p>
                    <p className="text-xs text-gray-400">{b.room.name} · {formatDate(b.checkIn)}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700">
                    {b.totalNights}m
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Villa Card ────────────────────────────────────────────────────────────────

type VillaCardProps = {
  room: { id: string; name: string; status: string; capacity: number | null; roomType: { name: string } | null }
  activeBooking?: {
    id: string; guestName: string; checkIn: Date; checkOut: Date
    status: string; totalPrice: number; paidAmount: number
  }
  tonightPrice: number
  facilityNames: string[]
}

function VillaCard({ room, activeBooking, tonightPrice, facilityNames }: VillaCardProps) {
  const isOccupied  = room.status === 'OCCUPIED'
  const hasUpcoming = !isOccupied && !!activeBooking

  return (
    <div className={`rounded-2xl border-2 overflow-hidden transition-all ${
      isOccupied      ? 'border-rose-200 bg-rose-50/30' :
      hasUpcoming     ? 'border-blue-200 bg-blue-50/20' :
      room.status === 'AVAILABLE' ? 'border-emerald-200 bg-white hover:border-emerald-400 hover:shadow-md' :
                        'border-gray-200 bg-gray-50'
    }`}>
      {/* Header */}
      <div className={`px-5 py-4 flex items-start justify-between ${
        isOccupied ? 'bg-rose-100/50' : hasUpcoming ? 'bg-blue-100/40' : 'bg-gray-50/80'
      }`}>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-lg font-bold text-gray-900">{room.name}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_BADGE[room.status] ?? 'bg-gray-100 text-gray-500'}`}>
              {STATUS_LABEL[room.status] ?? room.status}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{room.roomType?.name ?? '-'}</p>
        </div>
        {room.capacity != null && (
          <div className="text-right shrink-0 ml-2">
            <p className="text-xs text-gray-400">Kapasitas</p>
            <p className="text-base font-bold text-gray-700">{room.capacity} org</p>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-3">
        {/* Fasilitas chips */}
        {facilityNames.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {facilityNames.map((f) => (
              <span key={f} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-medium">{f}</span>
            ))}
          </div>
        )}

        {/* Harga */}
        {tonightPrice > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400">Mulai</span>
            <span className="text-sm font-bold text-teal-700">{formatRupiah(tonightPrice)}</span>
            <span className="text-xs text-gray-400">/ malam</span>
          </div>
        )}

        {/* Tamu aktif */}
        {isOccupied && activeBooking && (
          <div className="bg-rose-100/60 rounded-xl px-3 py-2.5">
            <p className="text-xs font-semibold text-rose-800">{activeBooking.guestName}</p>
            <p className="text-xs text-rose-600 mt-0.5">
              CO: {formatDate(activeBooking.checkOut)}
              {' · '}
              {activeBooking.totalPrice - activeBooking.paidAmount > 0
                ? <span className="font-semibold">Sisa {formatRupiah(activeBooking.totalPrice - activeBooking.paidAmount)}</span>
                : <span className="text-emerald-700 font-semibold">Lunas</span>
              }
            </p>
          </div>
        )}

        {/* Reservasi mendatang */}
        {hasUpcoming && activeBooking && (
          <div className="bg-blue-100/60 rounded-xl px-3 py-2.5">
            <p className="text-xs font-semibold text-blue-800">Reservasi: {activeBooking.guestName}</p>
            <p className="text-xs text-blue-600 mt-0.5">CI: {formatDate(activeBooking.checkIn)}</p>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="px-5 pb-5">
        {isOccupied && activeBooking ? (
          <Link href={`/homestay/booking/${activeBooking.id}`}
            className="block w-full text-center text-sm font-semibold text-rose-700 bg-rose-100 hover:bg-rose-200 py-2 rounded-xl transition-colors">
            Lihat Detail Tamu
          </Link>
        ) : room.status === 'AVAILABLE' ? (
          <Link href={`/homestay/booking/baru?roomId=${room.id}`}
            className="block w-full text-center text-sm font-semibold text-teal-700 bg-teal-100 hover:bg-teal-200 py-2 rounded-xl transition-colors">
            Buat Booking
          </Link>
        ) : (
          <p className="text-center text-xs text-gray-400 py-1">{STATUS_LABEL[room.status] ?? room.status}</p>
        )}
      </div>
    </div>
  )
}




