import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'

// DELETE — reset seluruh riwayat transaksi Pertashop (masuk & keluar) dan kembalikan
// stok tiap produk BBM ke 0. Destruktif & tidak bisa dibatalkan — khusus OWNER.
// Tidak menyentuh rekonsiliasi setoran (FuelReconciliation) — itu catatan audit terpisah.
export async function DELETE() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'OWNER') {
    return NextResponse.json({ error: 'Hanya Owner yang bisa mereset data Pertashop' }, { status: 403 })
  }

  const unit = await getTenantUnit(session.user.tenantId!, 'PERTASHOP')
  if (!unit) return NextResponse.json({ error: 'Unit Pertashop tidak ditemukan' }, { status: 404 })

  const result = await prisma.$transaction(async (tx) => {
    const purchases = await tx.fuelPurchase.deleteMany({ where: { unitId: unit.id } })
    const sales = await tx.fuelSale.deleteMany({ where: { unitId: unit.id } })
    const products = await tx.fuelProduct.updateMany({ where: { unitId: unit.id }, data: { stock: 0 } })
    return { purchases: purchases.count, sales: sales.count, products: products.count }
  })

  return NextResponse.json({ success: true, ...result })
}
