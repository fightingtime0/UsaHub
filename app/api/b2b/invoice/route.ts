import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateInvoiceNumber, calculateTax, calculateTotal } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const status = searchParams.get('status')
  const page   = parseInt(searchParams.get('page') ?? '1')
  const limit  = 25

  const where = {
    ...(status ? { status: status as any } : {}),
    sellerUnit: { tenantId: session.user.tenantId },
  }

  const [invoices, total] = await Promise.all([
    prisma.b2BInvoice.findMany({
      where,
      include: {
        sellerUnit: { select: { name: true } },
        buyerUnit:  { select: { name: true } },
        items:      true,
      },
      orderBy: { createdAt: 'desc' },
      skip:  (page - 1) * limit,
      take:  limit,
    }),
    prisma.b2BInvoice.count({ where }),
  ])

  return NextResponse.json({
    invoices: invoices.map((inv) => ({
      ...inv,
      subtotal:   Number(inv.subtotal),
      discount:   Number(inv.discount),
      taxRate:    Number(inv.taxRate),
      tax:        Number(inv.tax),
      total:      Number(inv.total),
      paidAmount: Number(inv.paidAmount),
      items: inv.items.map((item) => ({
        ...item,
        qty:      Number(item.qty),
        price:    Number(item.price),
        subtotal: Number(item.subtotal),
      })),
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { sellerUnitId, buyerUnitId, items, discount = 0, dueDate, note } = body

  if (!sellerUnitId || !buyerUnitId) {
    return NextResponse.json({ error: 'sellerUnitId dan buyerUnitId wajib diisi' }, { status: 400 })
  }
  if (!items || items.length === 0) {
    return NextResponse.json({ error: 'Minimal satu item' }, { status: 400 })
  }

  const sellerUnit = await prisma.businessUnit.findFirst({ where: { id: sellerUnitId, tenantId: session.user.tenantId } })
  if (!sellerUnit) return NextResponse.json({ error: 'Unit penjual tidak ditemukan' }, { status: 404 })

  const buyerUnit = await prisma.businessUnit.findFirst({ where: { id: buyerUnitId, tenantId: session.user.tenantId } })
  if (!buyerUnit) return NextResponse.json({ error: 'Unit pembeli tidak ditemukan' }, { status: 404 })

  // Validasi semua sellerProduct ada, milik sellerUnit yang sama, dan punya stok cukup
  for (const item of items) {
    const product = await prisma.product.findFirst({ where: { id: item.sellerProductId, unitId: sellerUnitId } })
    if (!product) return NextResponse.json({ error: `Produk ${item.sellerProductId} tidak ditemukan` }, { status: 400 })
    if (Number(product.stock) < item.qty) {
      return NextResponse.json({ error: `Stok ${product.name} tidak cukup (ada: ${product.stock}, diminta: ${item.qty})` }, { status: 400 })
    }
  }

  const subtotal = items.reduce((s: number, i: any) => s + i.qty * i.price, 0)
  const taxRate  = Number(sellerUnit.taxRate)
  const tax      = calculateTax(subtotal, discount, taxRate)
  const total    = calculateTotal(subtotal, discount, taxRate)

  const invoice = await prisma.b2BInvoice.create({
    data: {
      invoiceNumber: generateInvoiceNumber('B2B'),
      status:        'DRAFT',
      sellerUnitId,
      buyerUnitId,
      subtotal,
      discount,
      taxRate,
      tax,
      total,
      dueDate:  dueDate ? new Date(dueDate) : null,
      note:     note ?? null,
      items: {
        create: items.map((item: any) => ({
          sellerProductId: item.sellerProductId,
          productName:     item.productName,
          productUnit:     item.productUnit,
          qty:             item.qty,
          price:           item.price,
          subtotal:        item.qty * item.price,
        })),
      },
    },
    include: { items: true },
  })

  return NextResponse.json({
    ...invoice,
    subtotal: Number(invoice.subtotal),
    discount: Number(invoice.discount),
    tax:      Number(invoice.tax),
    total:    Number(invoice.total),
  }, { status: 201 })
}



