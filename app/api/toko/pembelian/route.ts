import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'
import { generateInvoiceNumber } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const status = searchParams.get('status') ?? undefined

  const unit = await getTenantUnit(session.user.tenantId!, 'RETAIL')
  if (!unit) return NextResponse.json({ error: 'Unit tidak ditemukan' }, { status: 404 })

  const orders = await prisma.purchaseOrder.findMany({
    where: {
      unitId: unit.id,
      ...(status && { status: status as any }),
    },
    include: {
      supplier: { select: { name: true } },
      items: { include: { product: { select: { name: true, unit: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(orders)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !['OWNER', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { supplierId, items, note } = body
  // items: [{ productId, qty, price }]

  if (!supplierId || !items || items.length === 0) {
    return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 })
  }

  const unit = await getTenantUnit(session.user.tenantId!, 'RETAIL')
  if (!unit) return NextResponse.json({ error: 'Unit tidak ditemukan' }, { status: 404 })

  const total = items.reduce((sum: number, i: any) => sum + i.price * i.qty, 0)

  const order = await prisma.purchaseOrder.create({
    data: {
      orderNumber: generateInvoiceNumber('PO'),
      supplierId,
      unitId: unit.id,
      total,
      status: 'DRAFT',
      note: note || null,
      items: {
        create: items.map((item: any) => ({
          productId: item.productId,
          qty: item.qty,
          price: item.price,
          subtotal: item.qty * item.price,
        })),
      },
    },
    include: {
      supplier: true,
      items: { include: { product: true } },
    },
  })

  return NextResponse.json(order, { status: 201 })
}



