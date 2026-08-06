import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'
import { generateInvoiceNumber } from '@/lib/utils'

// GET — semua order yang aktif (OPEN/BILLED) + summary per meja
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const unit = await getTenantUnit(session.user.tenantId!, 'RESTAURANT')
  if (!unit) return NextResponse.json({ error: 'Unit tidak ditemukan' }, { status: 404 })

  const orders = await prisma.tableOrder.findMany({
    where: { unitId: unit.id, status: { in: ['OPEN', 'BILLED'] } },
    include: {
      items: {
        include: { menuItem: { select: { name: true, price: true } } },
      },
    },
    orderBy: { openedAt: 'asc' },
  })

  return NextResponse.json(orders)
}

// POST — buka order baru
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { tableNumber, guestCount } = body

  if (!tableNumber) {
    return NextResponse.json({ error: 'Nomor meja wajib diisi' }, { status: 400 })
  }

  const unit = await getTenantUnit(session.user.tenantId!, 'RESTAURANT')
  if (!unit) return NextResponse.json({ error: 'Unit tidak ditemukan' }, { status: 404 })

  // Cek apakah meja sudah ada order OPEN
  const existing = await prisma.tableOrder.findFirst({
    where: { unitId: unit.id, tableNumber, status: { in: ['OPEN', 'BILLED'] } },
  })
  if (existing) {
    return NextResponse.json({ error: `Meja ${tableNumber} sudah ada order aktif`, orderId: existing.id }, { status: 409 })
  }

  const order = await prisma.tableOrder.create({
    data: {
      orderNumber: generateInvoiceNumber('ORD'),
      tableNumber,
      guestCount: guestCount ?? null,
      status: 'OPEN',
      taxRate: Number(unit.taxRate),
      unitId: unit.id,
    },
  })

  return NextResponse.json(order, { status: 201 })
}



