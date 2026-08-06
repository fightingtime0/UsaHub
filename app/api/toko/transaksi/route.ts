import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'
import { generateInvoiceNumber, calculateTax } from '@/lib/utils'
import { startOfDay, endOfDay } from 'date-fns'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const dateStr = searchParams.get('date')
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '20')

  const unit = await getTenantUnit(session.user.tenantId!, 'RETAIL')
  if (!unit) return NextResponse.json({ error: 'Unit tidak ditemukan' }, { status: 404 })

  const dateFilter = dateStr
    ? { gte: startOfDay(new Date(dateStr)), lte: endOfDay(new Date(dateStr)) }
    : undefined

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        unitId: unit.id,
        ...(dateFilter && { createdAt: dateFilter }),
      },
      include: {
        items: {
          include: { product: { select: { name: true, unit: true } } },
        },
        customer: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transaction.count({
      where: { unitId: unit.id, ...(dateFilter && { createdAt: dateFilter }) },
    }),
  ])

  return NextResponse.json({ transactions, total, page, limit })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { items, paymentMethod, paidAmount, customerId, discount = 0 } = body

  // items: [{ productId, qty, price }]
  if (!items || items.length === 0) {
    return NextResponse.json({ error: 'Keranjang kosong' }, { status: 400 })
  }
  if (!paymentMethod) {
    return NextResponse.json({ error: 'Metode pembayaran wajib dipilih' }, { status: 400 })
  }

  const unit = await getTenantUnit(session.user.tenantId!, 'RETAIL')
  if (!unit) return NextResponse.json({ error: 'Unit tidak ditemukan' }, { status: 404 })

  // Validasi stok semua produk
  const productIds = items.map((i: any) => i.productId)
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, unitId: unit.id, isActive: true },
  })

  for (const item of items) {
    const prod = products.find((p) => p.id === item.productId)
    if (!prod) return NextResponse.json({ error: `Produk tidak ditemukan: ${item.productId}` }, { status: 400 })
    if (Number(prod.stock) < item.qty) {
      return NextResponse.json({ error: `Stok ${prod.name} tidak cukup (tersisa ${prod.stock} ${prod.unit})` }, { status: 400 })
    }
  }

  const subtotal = items.reduce((sum: number, i: any) => sum + i.price * i.qty, 0)
  const taxRate = Number(unit.taxRate)
  const tax = calculateTax(subtotal, Number(discount), taxRate)
  const total = subtotal - Number(discount) + tax
  const change = Number(paidAmount) - total

  if (change < 0) {
    return NextResponse.json({ error: 'Jumlah bayar kurang' }, { status: 400 })
  }

  const transaction = await prisma.$transaction(async (tx) => {
    // Buat transaksi
    const trx = await tx.transaction.create({
      data: {
        invoiceNumber: generateInvoiceNumber('TK'),
        type: 'RETAIL',
        status: 'PAID',
        paymentMethod,
        subtotal,
        discount,
        taxRate,
        tax,
        total,
        paidAmount,
        change,
        unitId: unit.id,
        customerId: customerId || null,
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            qty: item.qty,
            price: item.price,
            discount: item.itemDiscount ?? 0,
            subtotal: item.price * item.qty,
          })),
        },
      },
      include: {
        items: { include: { product: true } },
      },
    })

    // Update stok + catat movement
    for (const item of items) {
      const prod = products.find((p) => p.id === item.productId)!
      const qtyBefore = Number(prod.stock)
      const qtyAfter = qtyBefore - item.qty

      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.qty } },
      })

      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          type: 'OUT',
          qty: item.qty,
          qtyBefore,
          qtyAfter,
          refType: 'Transaction',
          refId: trx.id,
          note: `Penjualan ${trx.invoiceNumber}`,
        },
      })
    }

    return trx
  })

  return NextResponse.json(transaction, { status: 201 })
}



