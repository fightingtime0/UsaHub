import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'
import { generateInvoiceNumber } from '@/lib/utils'

// GET — daftar reservasi rombongan Kopi Telo
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const unit = await getTenantUnit(session.user.tenantId!, 'KOPI_TELO')
  if (!unit) return NextResponse.json({ error: 'Unit Kopi Telo tidak ditemukan' }, { status: 404 })

  const reservasi = await prisma.groupOrder.findMany({
    where: { unitId: unit.id },
    orderBy: { eventDate: 'desc' },
    take: 100,
  })

  return NextResponse.json(reservasi)
}

// POST — operator mencatat reservasi manual (telepon/walk-in)
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { travelName, customerName, busPo, customerPhone, eventDate, pax, menuType, customMenu, pricePerPax, dpAmount, note } = body

  if (!customerName || !eventDate || !pax || !menuType || pricePerPax === undefined) {
    return NextResponse.json(
      { error: 'Nama rombongan, tanggal, jumlah peserta, menu, dan harga per orang wajib diisi' },
      { status: 400 }
    )
  }
  if (Number(pax) <= 0) {
    return NextResponse.json({ error: 'Jumlah peserta harus lebih dari 0' }, { status: 400 })
  }

  const unit = await getTenantUnit(session.user.tenantId!, 'KOPI_TELO')
  if (!unit) return NextResponse.json({ error: 'Unit Kopi Telo tidak ditemukan' }, { status: 404 })

  const dp = Number(dpAmount ?? 0)
  const reservasi = await prisma.groupOrder.create({
    data: {
      orderCode: generateInvoiceNumber('RSV'),
      travelName: travelName ?? null,
      customerName,
      busPo: busPo ?? null,
      customerPhone: customerPhone ?? null,
      source: 'ADMIN',
      eventDate: new Date(eventDate),
      pax: Number(pax),
      menuType,
      customMenu: customMenu ?? null,
      pricePerPax: Number(pricePerPax),
      totalPrice: Number(pax) * Number(pricePerPax),
      dpAmount: dp,
      paidAmount: dp,
      status: dp > 0 ? 'CONFIRMED' : 'PENDING',
      note: note ?? null,
      unitId: unit.id,
    },
  })

  return NextResponse.json(reservasi, { status: 201 })
}
