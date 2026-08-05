import { NextRequest, NextResponse } from 'next/server'
import { getSession, hasUnitAccess } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateInvoiceNumber } from '@/lib/utils'

// GET — riwayat penjualan BBM
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasUnitAccess(session, 'PERTASHOP')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const unit = await prisma.businessUnit.findFirst({ where: { type: 'PERTASHOP', isActive: true } })
  if (!unit) return NextResponse.json({ error: 'Unit Pertashop tidak ditemukan' }, { status: 404 })

  const sales = await prisma.fuelSale.findMany({
    where: { unitId: unit.id },
    include: { fuelProduct: { select: { name: true } } },
    orderBy: { soldAt: 'desc' },
    take: 100,
  })

  return NextResponse.json(sales)
}

// POST — catat transaksi KELUAR (penjualan BBM).
// Margin dihitung dari snapshot harga beli produk saat ini. actualStock (hasil ukur tangki
// setelah penjualan) wajib diisi — dipakai untuk memantau penguapan/susut secara berkelanjutan,
// dan menjadi acuan koreksi stok sistem.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasUnitAccess(session, 'PERTASHOP')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { fuelProductId, liters, sellPrice, actualStock, shift, note, soldAt } = body

  if (!fuelProductId || !liters) {
    return NextResponse.json({ error: 'Produk dan liter wajib diisi' }, { status: 400 })
  }
  if (Number(liters) <= 0) {
    return NextResponse.json({ error: 'Liter harus lebih dari 0' }, { status: 400 })
  }
  if (actualStock === undefined || actualStock === null || actualStock === '') {
    return NextResponse.json({ error: 'Stok sekarang (hasil ukur tangki) wajib diisi' }, { status: 400 })
  }
  if (Number(actualStock) < 0) {
    return NextResponse.json({ error: 'Stok sekarang tidak boleh negatif' }, { status: 400 })
  }

  const product = await prisma.fuelProduct.findUnique({ where: { id: fuelProductId } })
  if (!product || !product.isActive) {
    return NextResponse.json({ error: 'Produk BBM tidak ditemukan' }, { status: 404 })
  }

  const litersNum = Number(liters)
  const price = sellPrice ? Number(sellPrice) : Number(product.sellPrice)
  const buyPrice = Number(product.buyPrice)
  const total = litersNum * price
  const margin = litersNum * (price - buyPrice)
  const expectedStock = Number(product.stock) - litersNum
  const actual = Number(actualStock)
  const lossLiters = expectedStock - actual

  const [sale] = await prisma.$transaction([
    prisma.fuelSale.create({
      data: {
        saleNumber: generateInvoiceNumber('FJL'),
        liters: litersNum,
        sellPrice: price,
        buyPrice,
        total,
        margin,
        shift: shift || null,
        expectedStock,
        actualStock: actual,
        lossLiters,
        note: note ?? null,
        soldAt: soldAt ? new Date(soldAt) : new Date(),
        fuelProductId,
        unitId: product.unitId,
      },
    }),
    prisma.fuelProduct.update({
      where: { id: fuelProductId },
      data: { stock: actual }, // koreksi ke hasil ukur, bukan sekadar decrement
    }),
  ])

  return NextResponse.json(sale, { status: 201 })
}
