import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'
import { generateInvoiceNumber } from '@/lib/utils'

// GET — daftar pesanan rombongan
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const unit = await getTenantUnit(session.user.tenantId!, 'RESTAURANT')
  if (!unit) return NextResponse.json({ error: 'Unit Restoran tidak ditemukan' }, { status: 404 })

  const orders = await prisma.groupOrder.findMany({
    where: { unitId: unit.id },
    orderBy: { eventDate: 'desc' },
    take: 100,
  })

  return NextResponse.json(orders)
}

// POST — buat pesanan rombongan baru
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { customerName, customerPhone, eventDate, pax, menuType, customMenu, pricePerPax, dpAmount, note } = body

  if (!customerName || !eventDate || !pax || !menuType || pricePerPax === undefined) {
    return NextResponse.json(
      { error: 'Nama pemesan, tanggal acara, jumlah pax, jenis menu, dan harga per pax wajib diisi' },
      { status: 400 }
    )
  }
  if (Number(pax) <= 0) {
    return NextResponse.json({ error: 'Jumlah pax harus lebih dari 0' }, { status: 400 })
  }

  const unit = await getTenantUnit(session.user.tenantId!, 'RESTAURANT')
  if (!unit) return NextResponse.json({ error: 'Unit Restoran tidak ditemukan' }, { status: 404 })

  const totalPrice = Number(pax) * Number(pricePerPax)
  const dp = Number(dpAmount ?? 0)

  const order = await prisma.groupOrder.create({
    data: {
      orderCode: generateInvoiceNumber('RMB'),
      customerName,
      customerPhone: customerPhone ?? null,
      eventDate: new Date(eventDate),
      pax: Number(pax),
      menuType,
      customMenu: customMenu ?? null,
      pricePerPax: Number(pricePerPax),
      totalPrice,
      dpAmount: dp,
      paidAmount: dp,
      status: dp > 0 ? 'CONFIRMED' : 'PENDING',
      note: note ?? null,
      unitId: unit.id,
    },
  })

  return NextResponse.json(order, { status: 201 })
}
