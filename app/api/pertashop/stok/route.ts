import { NextRequest, NextResponse } from 'next/server'
import { getSession, hasUnitAccess } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'

// GET — riwayat pengukuran stok (loss)
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasUnitAccess(session, 'PERTASHOP')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const unit = await getTenantUnit(session.user.tenantId!, 'PERTASHOP')
  if (!unit) return NextResponse.json({ error: 'Unit Pertashop tidak ditemukan' }, { status: 404 })

  const readings = await prisma.fuelStockReading.findMany({
    where: { unitId: unit.id },
    include: { fuelProduct: { select: { name: true } } },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: 100,
  })

  return NextResponse.json(readings)
}

// POST — catat pengukuran stok tangki.
// Stok sistem (FuelProduct.stock) selalu = pembacaan terakhir ± belanja/penjualan
// sejak pembacaan itu, sehingga:
//  - OPENING: expected = stok sistem (= actual CLOSING kemarin) → loss = penguapan malam
//  - CLOSING: expected = stok sistem (= actual OPENING + belanja − sales) → loss = penguapan siang
// Setelah dicatat, stok sistem dikoreksi ke hasil ukur (actual).
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasUnitAccess(session, 'PERTASHOP')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { fuelProductId, type, date, actualLiters, shift, note } = body

  if (!fuelProductId || !type || !date || actualLiters === undefined) {
    return NextResponse.json({ error: 'Produk, jenis, tanggal, dan hasil ukur wajib diisi' }, { status: 400 })
  }
  if (!['OPENING', 'CLOSING'].includes(type)) {
    return NextResponse.json({ error: 'Jenis pengukuran tidak valid' }, { status: 400 })
  }
  if (Number(actualLiters) < 0) {
    return NextResponse.json({ error: 'Hasil ukur tidak boleh negatif' }, { status: 400 })
  }

  const product = await prisma.fuelProduct.findUnique({
    where: { id: fuelProductId },
    include: { unit: { select: { tenantId: true } } },
  })
  if (!product || !product.isActive || product.unit.tenantId !== session.user.tenantId) {
    return NextResponse.json({ error: 'Produk BBM tidak ditemukan' }, { status: 404 })
  }

  const expected = Number(product.stock)
  const actual = Number(actualLiters)
  const loss = expected - actual

  try {
    const [reading] = await prisma.$transaction([
      prisma.fuelStockReading.create({
        data: {
          type,
          date: new Date(date),
          expectedLiters: expected,
          actualLiters: actual,
          lossLiters: loss,
          shift: shift || null,
          note: note ?? null,
          fuelProductId,
          unitId: product.unitId,
        },
      }),
      // koreksi stok sistem ke hasil ukur
      prisma.fuelProduct.update({
        where: { id: fuelProductId },
        data: { stock: actual },
      }),
    ])
    return NextResponse.json(reading, { status: 201 })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json(
        { error: `Pengukuran ${type === 'OPENING' ? 'buka' : 'tutup'} untuk produk & tanggal ini sudah dicatat` },
        { status: 409 }
      )
    }
    throw e
  }
}
