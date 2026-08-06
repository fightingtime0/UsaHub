/**
 * lib/accommodation.ts
 * Shared business logic untuk Homestay (HOMESTAY) dan Penginapan (LODGING).
 * Semua fungsi menerima `unitType` agar bisa dipakai oleh kedua modul.
 */

import { prisma } from './prisma'
import { resolveNightlyPricing, calcBookingTotal, generateBookingCode } from './pricing'
import { startOfDay } from 'date-fns'
import type { UnitType } from '@prisma/client'

// ─── Types ────────────────────────────────────────────────────────────────────

export type BookingCreateInput = {
  roomId: string
  guestName: string
  guestPhone?: string
  guestEmail?: string
  guestIdNum?: string
  checkIn: string   // ISO date
  checkOut: string  // ISO date
  source?: string
  extraBed?: number
  extraBedPrice?: number
  note?: string
  dpAmount?: number
  dpMethod?: string
}

export type PaymentAddInput = {
  bookingId: string
  amount: number
  method: string
  type: 'DP' | 'FULL' | 'REFUND'
  note?: string
}

// ─── Unit resolver ─────────────────────────────────────────────────────────────

export async function getAccomUnit(tenantId: string, unitType: UnitType) {
  return prisma.businessUnit.findFirst({
    where: { type: unitType, isActive: true, tenantId },
  })
}

// ─── Room list ─────────────────────────────────────────────────────────────────

export async function getRooms(tenantId: string, unitType: UnitType) {
  const unit = await getAccomUnit(tenantId, unitType)
  if (!unit) return null

  return prisma.room.findMany({
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
  })
}

// ─── Pricing preview ──────────────────────────────────────────────────────────

export async function previewPricing(tenantId: string, roomId: string, checkIn: string, checkOut: string) {
  const checkInDate  = new Date(checkIn)
  const checkOutDate = new Date(checkOut)

  if (checkInDate >= checkOutDate) return null

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { pricing: true, unit: { select: { tenantId: true } } },
  })
  if (!room || room.unit.tenantId !== tenantId) return null

  const breakdown  = resolveNightlyPricing(checkInDate, checkOutDate, room.pricing)
  const total      = calcBookingTotal(breakdown)
  const totalNights = breakdown.length

  return { breakdown, total, totalNights }
}

// ─── Create booking ────────────────────────────────────────────────────────────

export async function createBooking(tenantId: string, unitType: UnitType, input: BookingCreateInput) {
  const unit = await getAccomUnit(tenantId, unitType)
  if (!unit) throw new Error('Unit tidak ditemukan')

  const checkInDate  = startOfDay(new Date(input.checkIn))
  const checkOutDate = startOfDay(new Date(input.checkOut))

  if (checkInDate >= checkOutDate) throw new Error('checkOut harus setelah checkIn')

  // Conflict check
  const conflict = await prisma.booking.findFirst({
    where: {
      roomId: input.roomId,
      status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
      checkIn:  { lt: checkOutDate },
      checkOut: { gt: checkInDate },
    },
  })
  if (conflict) throw new Error(`Sudah ada booking aktif pada tanggal tersebut (${conflict.bookingCode})`)

  const room = await prisma.room.findUnique({
    where: { id: input.roomId },
    include: { pricing: true },
  })
  if (!room || !room.isActive || room.unitId !== unit.id) throw new Error('Kamar tidak tersedia')

  const breakdown    = resolveNightlyPricing(checkInDate, checkOutDate, room.pricing)
  const totalNights  = breakdown.length
  const roomTotal    = calcBookingTotal(breakdown)
  const eb           = input.extraBed ?? 0
  const ebPrice      = input.extraBedPrice ?? 0
  const extraTotal   = eb * ebPrice * totalNights
  const totalPrice   = roomTotal + extraTotal
  const pricePerNight = totalNights > 0 ? Math.round(roomTotal / totalNights) : 0
  const dp           = Math.min(Number(input.dpAmount ?? 0), totalPrice)

  const booking = await prisma.$transaction(async (tx) => {
    const bk = await tx.booking.create({
      // @ts-ignore
      // @ts-ignore
      data: {
        bookingCode:    generateBookingCode(),
        guestName:      input.guestName,
        guestPhone:     input.guestPhone  ?? null,
        guestEmail:     input.guestEmail  ?? null,
        guestIdNum:     input.guestIdNum  ?? null,
        checkIn:        checkInDate,
        checkOut:       checkOutDate,
        totalNights,
        pricePerNight,
        totalPrice,
        dpAmount:       dp,
        paidAmount:     dp,
        extraBed:       eb,
        extraBedPrice:  ebPrice,
        status:         'CONFIRMED',
        source:         input.source ?? 'walk-in',
        note:           input.note   ?? null,
        roomId:         input.roomId,
        unitId:         unit.id,
        ...(dp > 0 && input.dpMethod ? {
          payments: {
            create: { amount: dp, method: input.dpMethod, type: 'DP', note: 'DP saat booking' },
          },
        } : {}),
      },
      include: {
        room:     { select: { name: true, roomType: { select: { name: true } } } },
        payments: true,
      },
    })
    return bk
  })

  return { booking, breakdown }
}

// ─── Update booking status ────────────────────────────────────────────────────

export async function updateBookingStatus(tenantId: string, bookingId: string, newStatus: string) {
  const VALID: Record<string, string[]> = {
    PENDING:    ['CONFIRMED', 'CANCELLED'],
    CONFIRMED:  ['CHECKED_IN', 'CANCELLED'],
    CHECKED_IN: ['CHECKED_OUT'],
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { room: true, unit: { select: { tenantId: true } } },
  })
  if (!booking || booking.unit.tenantId !== tenantId) throw new Error('Booking tidak ditemukan')
  if (!VALID[booking.status]?.includes(newStatus)) {
    throw new Error(`Tidak bisa ubah status dari ${booking.status} ke ${newStatus}`)
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: { status: newStatus as any },
      include: { room: { select: { id: true, name: true } }, payments: true },
    })

    if (newStatus === 'CHECKED_IN') {
      await tx.room.update({ where: { id: booking.roomId }, data: { status: 'OCCUPIED' } })
    } else if (newStatus === 'CHECKED_OUT' || newStatus === 'CANCELLED') {
      const other = await tx.booking.findFirst({
        where: { roomId: booking.roomId, id: { not: bookingId }, status: 'CHECKED_IN' },
      })
      if (!other) {
        await tx.room.update({ where: { id: booking.roomId }, data: { status: 'AVAILABLE' } })
      }
    }

    return updated
  })
}

// ─── Add payment ──────────────────────────────────────────────────────────────

export async function addPayment(tenantId: string, input: PaymentAddInput) {
  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    include: { payments: true, unit: { select: { tenantId: true } } },
  })
  if (!booking || booking.unit.tenantId !== tenantId) throw new Error('Booking tidak ditemukan')
  if (['CANCELLED', 'CHECKED_OUT'].includes(booking.status)) {
    throw new Error('Booking sudah selesai atau dibatalkan')
  }

  const paid      = booking.payments.filter((p) => p.type !== 'REFUND').reduce((s, p) => s + Number(p.amount), 0)
  const refunded  = booking.payments.filter((p) => p.type === 'REFUND').reduce((s, p) => s + Number(p.amount), 0)
  const netPaid   = paid - refunded
  const totalPrice = Number(booking.totalPrice)

  if (input.type !== 'REFUND' && netPaid + input.amount > totalPrice) {
    throw new Error(`Melebihi tagihan. Sisa: ${totalPrice - netPaid}`)
  }

  const newPaidAmount = input.type === 'REFUND'
    ? Math.max(0, netPaid - input.amount)
    : netPaid + input.amount

  return prisma.$transaction(async (tx) => {
    const payment = await tx.bookingPayment.create({
      data: {
        bookingId: input.bookingId,
        amount: input.amount,
        method: input.method as any,
        type: input.type,
        note: input.note ?? null,
        paidAt: new Date(),
      },
    })
    await tx.booking.update({
      where: { id: input.bookingId },
      data: { paidAmount: newPaidAmount },
    })
    return { ...payment, amount: Number(payment.amount) }
  })
}

// ─── Serialize helpers ─────────────────────────────────────────────────────────

export function serializeBooking(b: any) {
  return {
    ...b,
    totalPrice:    Number(b.totalPrice),
    dpAmount:      Number(b.dpAmount),
    paidAmount:    Number(b.paidAmount),
    pricePerNight: Number(b.pricePerNight),
    extraBedPrice: Number(b.extraBedPrice ?? 0),
    payments: (b.payments ?? []).map((p: any) => ({ ...p, amount: Number(p.amount) })),
  }
}


