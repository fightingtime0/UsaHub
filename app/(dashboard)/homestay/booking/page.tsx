import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'
import { formatRupiah, formatDate } from '@/lib/utils'
import Link from 'next/link'

const STATUS_BADGE: Record<string, string> = {
  PENDING:    'bg-yellow-100 text-yellow-700',
  CONFIRMED:  'bg-blue-100 text-blue-700',
  CHECKED_IN: 'bg-green-100 text-green-700',
  CHECKED_OUT:'bg-gray-100 text-gray-600',
  CANCELLED:  'bg-red-100 text-red-600',
}
const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending', CONFIRMED: 'Dikonfirmasi', CHECKED_IN: 'Check-in',
  CHECKED_OUT: 'Check-out', CANCELLED: 'Dibatalkan',
}

export default async function HomestayBookingListPage({
  searchParams,
}: {
  searchParams: { status?: string; page?: string }
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  const unit = await getTenantUnit(session.user.tenantId!, 'HOMESTAY')
  if (!unit) return <p>Unit tidak ditemukan.</p>

  const filterStatus = searchParams.status as any ?? undefined
  const page  = parseInt(searchParams.page ?? '1')
  const limit = 25

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where: { unitId: unit.id, ...(filterStatus && { status: filterStatus }) },
      include: { room: { select: { name: true, roomType: { select: { name: true } } } } },
      orderBy: { checkIn: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.booking.count({ where: { unitId: unit.id, ...(filterStatus && { status: filterStatus }) } }),
  ])

  const totalPages = Math.ceil(total / limit)
  const statuses = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED']

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Semua Booking Villa</h1>
          <p className="text-sm text-gray-500">{total} booking ditemukan</p>
        </div>
        <Link href="/homestay/booking/baru"
          className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors">
          + Booking Baru
        </Link>
      </div>

      {/* Filter Status */}
      <div className="flex gap-2 flex-wrap">
        {[undefined, ...statuses].map((s) => (
          <Link key={s ?? 'all'} href={s ? `?status=${s}` : '?'}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              filterStatus === s
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}>
            {s ? STATUS_LABEL[s] : 'Semua'}
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-5 py-3 font-semibold">Kode</th>
                <th className="px-5 py-3 font-semibold">Tamu</th>
                <th className="px-5 py-3 font-semibold">Villa</th>
                <th className="px-5 py-3 font-semibold">Check-in</th>
                <th className="px-5 py-3 font-semibold">Check-out</th>
                <th className="px-5 py-3 font-semibold">Malam</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold text-right">Total</th>
                <th className="px-5 py-3 font-semibold text-right">Sisa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {bookings.length === 0 && (
                <tr><td colSpan={9} className="px-5 py-12 text-center text-sm text-gray-400">Tidak ada booking</td></tr>
              )}
              {bookings.map((b) => {
                const remaining = Number(b.totalPrice) - Number(b.paidAmount)
                return (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3.5">
                      <Link href={`/homestay/booking/${b.id}`}
                        className="font-medium text-teal-600 hover:underline text-xs">
                        {b.bookingCode}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-gray-900">{b.guestName}</p>
                      {b.guestPhone && <p className="text-xs text-gray-400">{b.guestPhone}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-gray-700">
                      {b.room.name}
                      {b.room.roomType && <p className="text-xs text-gray-400">{b.room.roomType.name}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">{formatDate(b.checkIn)}</td>
                    <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">{formatDate(b.checkOut)}</td>
                    <td className="px-5 py-3.5 text-center text-gray-700">{b.totalNights}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[b.status]}`}>
                        {STATUS_LABEL[b.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-gray-900">
                      {formatRupiah(Number(b.totalPrice))}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {remaining > 0 ? (
                        <span className="font-semibold text-red-600">{formatRupiah(remaining)}</span>
                      ) : (
                        <span className="text-green-600 font-medium">Lunas</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-600">
            <span>Halaman {page} dari {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 && <Link href={`?${filterStatus ? `status=${filterStatus}&` : ''}page=${page - 1}`} className="px-3 py-1 rounded border border-gray-200 hover:bg-gray-50">← Sebelumnya</Link>}
              {page < totalPages && <Link href={`?${filterStatus ? `status=${filterStatus}&` : ''}page=${page + 1}`} className="px-3 py-1 rounded border border-gray-200 hover:bg-gray-50">Berikutnya →</Link>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


