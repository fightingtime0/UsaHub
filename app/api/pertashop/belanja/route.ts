import { NextRequest, NextResponse } from 'next/server'
import { getSession, hasUnitAccess } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'
import { generateInvoiceNumber } from '@/lib/utils'

// GET — riwayat belanja BBM
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasUnitAccess(session, 'PERTASHOP')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const unit = await getTenantUnit(session.user.tenantId!, 'PERTASHOP')
  if (!unit) return NextResponse.json({ error: 'Unit Pertashop tidak ditemukan' }, { status: 404 })

  const purchases = await prisma.fuelPurchase.findMany({
    where: { unitId: unit.id },
    include: { fuelProduct: { select: { name: true } } },
    orderBy: { purchasedAt: 'desc' },
    take: 100,
  })

  return NextResponse.json(purchases)
}

// POST — catat transaksi MASUK (belanja/pengisian stok BBM).
// actualStock (hasil ukur tangki setelah pengisian) wajib diisi — dipakai untuk memantau
// penguapan/susut secara berkelanjutan, dan menjadi acuan koreksi stok sistem.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasUnitAccess(session, 'PERTASHOP')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { fuelProductId, liters, buyPrice, doSize, actualStock, shift, note, purchasedAt } = body

  if (!fuelProductId || !liters || !buyPrice) {
    return NextResponse.json({ error: 'Produk, liter, dan harga beli wajib diisi' }, { status: 400 })
  }
  if (Number(liters) <= 0 || Number(buyPrice) <= 0) {
    return NextResponse.json({ error: 'Liter dan harga beli harus lebih dari 0' }, { status: 400 })
  }
  if (actualStock === undefined || actualStock === null || actualStock === '') {
    return NextResponse.json({ error: 'Stok sekarang (hasil ukur tangki) wajib diisi' }, { status: 400 })
  }
  if (Number(actualStock) < 0) {
    return NextResponse.json({ error: 'Stok sekarang tidak boleh negatif' }, { status: 400 })
  }

  const product = await prisma.fuelProduct.findUnique({
    where: { id: fuelProductId },
    include: { unit: { select: { tenantId: true } } },
  })
  if (!product || !product.isActive || product.unit.tenantId !== session.user.tenantId) {
    return NextResponse.json({ error: 'Produk BBM tidak ditemukan' }, { status: 404 })
  }

  const litersNum = Number(liters)
  const total = litersNum * Number(buyPrice)
  const expectedStock = Number(product.stock) + litersNum
  const actual = Number(actualStock)
  const lossLiters = expectedStock - actual

  const [purchase] = await prisma.$transaction([
    prisma.fuelPurchase.create({
      data: {
        purchaseNumber: generateInvoiceNumber('FBL'),
        liters: litersNum,
        buyPrice: Number(buyPrice),
        total,
        doSize: doSize || null,
        shift: shift || null,
        expectedStock,
        actualStock: actual,
        lossLiters,
        note: note ?? null,
        purchasedAt: purchasedAt ? new Date(purchasedAt) : new Date(),
        fuelProductId,
        unitId: product.unitId,
      },
    }),
    prisma.fuelProduct.update({
      where: { id: fuelProductId },
      data: {
        stock: actual, // koreksi ke hasil ukur, bukan sekadar increment
        buyPrice: Number(buyPrice), // harga beli terbaru jadi acuan margin berikutnya
      },
    }),
  ])

  return NextResponse.json(purchase, { status: 201 })
}
