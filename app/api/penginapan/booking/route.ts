import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'
import { resolveNightlyPricing, calcBookingTotal, generateBookingCode } from '@/lib/pricing'
import { startOfDay } from 'date-fns'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const status = searchParams.get('status') as any ?? undefined
  const page   = parseInt(searchParams.get('page') ?? '1')
  const limit  = 20

  const unit = await getTenantUnit(session.user.tenantId!, 'LODGING')
  if (!unit) return NextResponse.json({ error: 'Unit tidak ditemukan' }, { status: 404 })

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where: {
        unitId: unit.id,
        ...(status && { status }),
      },
      include: {
        room: { select: { name: true, roomType: { select: { name: true } } } },
        payments: { orderBy: { paidAt: 'desc' } },
      },
      orderBy: { checkIn: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.booking.count({
      where: { unitId: unit.id, ...(status && { status }) },
    }),
  ])

  const serialized = bookings.map((b) => ({
    ...b,
    totalPrice: Number(b.totalPrice),
    dpAmount: Number(b.dpAmount),
    paidAmount: Number(b.paidAmount),
    pricePerNight: Number(b.pricePerNight),
    extraBedPrice: Number(b.extraBedPrice),
    payments: b.payments.map((p) => ({ ...p, amount: Number(p.amount) })),
  }))

  return NextResponse.json({ bookings: serialized, total, page, limit })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    roomId,
    guestName,
    guestPhone,
    guestEmail,
    guestIdNum,
    checkIn,
    checkOut,
    source = 'walk-in',
    extraBed = 0,
    extraBedPrice = 0,
    note,
    dpAmount = 0,
    dpMethod,
  } = body

  if (!roomId || !guestName || !checkIn || !checkOut) {
    return NextResponse.json({ error: 'roomId, guestName, checkIn, checkOut wajib diisi' }, { status: 400 })
  }

  const checkInDate  = startOfDay(new Date(checkIn))
  const checkOutDate = startOfDay(new Date(checkOut))

  if (checkInDate >= checkOutDate) {
    return NextResponse.json({ error: 'checkOut harus setelah checkIn' }, { status: 400 })
  }

  const unit = await getTenantUnit(session.user.tenantId!, 'LODGING')
  if (!unit) return NextResponse.json({ error: 'Unit tidak ditemukan' }, { status: 404 })

  // Cek konflik booking pada kamar yang sama
  const conflict = await prisma.booking.findFirst({
    where: {
      roomId,
      status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
      OR: [
        { checkIn: { lt: checkOutDate }, checkOut: { gt: checkInDate } },
      ],
    },
  })
  if (conflict) {
    return NextResponse.json({
      error: `Kamar sudah dipesan untuk tanggal tersebut (Booking: ${conflict.bookingCode})`,
    }, { status: 409 })
  }

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { pricing: true },
  })
  if (!room || room.unitId !== unit.id) return NextResponse.json({ error: 'Kamar tidak ditemukan' }, { status: 404 })
  if (!room.isActive) return NextResponse.json({ error: 'Kamar tidak tersedia' }, { status: 400 })

  // Hitung harga dinamis
  const breakdown = resolveNightlyPricing(checkInDate, checkOutDate, room.pricing)
  const totalNights = breakdown.length
  // Ambil harga representatif (rata-rata, untuk field pricePerNight)
  const pricePerNight = totalNights > 0
    ? Math.round(calcBookingTotal(breakdown) / totalNights)
    : 0
  const roomTotal   = calcBookingTotal(breakdown)
  const extraTotal  = extraBed * Number(extraBedPrice) * totalNights
  const totalPrice  = roomTotal + extraTotal

  const dp = Math.min(Number(dpAmount), totalPrice)

  const booking = await prisma.$transaction(async (tx) => {
    const bk = await tx.booking.create({
      data: {
        bookingCode: generateBookingCode(),
        guestName,
        guestPhone: guestPhone ?? null,
        guestEmail: guestEmail ?? null,
        guestIdNum: guestIdNum ?? null,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        totalNights,
        pricePerNight,
        totalPrice,
        dpAmount: dp,
        paidAmount: dp,
        extraBed,
        extraBedPrice: Number(extraBedPrice),
        status: 'CONFIRMED',
        source,
        note: note ?? null,
        roomId,
        unitId: unit.id,
        ...(dp > 0 && dpMethod && {
          payments: {
            create: {
              amount: dp,
              method: dpMethod,
              type: 'DP',
              note: 'DP saat booking',
            },
          },
        }),
      },
      include: {
        room: { select: { name: true, roomType: { select: { name: true } } } },
        payments: true,
      },
    })
    return bk
  })

  return NextResponse.json({
    ...booking,
    totalPrice: Number(booking.totalPrice),
    dpAmount: Number(booking.dpAmount),
    paidAmount: Number(booking.paidAmount),
    pricePerNight: Number(booking.pricePerNight),
    breakdown,
  }, { status: 201 })
}



