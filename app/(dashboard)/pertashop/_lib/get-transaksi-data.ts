import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'
import type { getSession } from '@/lib/auth'

type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>

export type TransaksiPageData = {
  role: string
  products: { id: string; name: string; stock: number; buyPrice: number; sellPrice: number }[]
  log: {
    id: string
    direction: 'IN' | 'OUT' | 'STOK'
    productName: string
    liters: number | null
    price: number | null
    total: number | null
    shift: string | null
    actualStock: number | null
    lossLiters: number | null
    note: string | null
    at: string
  }[]
  employees: { id: string; name: string }[]
  currentEmployeeId: string | null
}

// Data bersama untuk semua entry point "Laporan Shift" (Input Transaksi, Input Penjualan,
// Input Belanja, Input Stok Awal) — sama, cuma beda mode default yang dikunci di client.
export async function getTransaksiPageData(session: Session): Promise<TransaksiPageData | null> {
  const unit = await getTenantUnit(session.user.tenantId!, 'PERTASHOP')
  if (!unit) return null

  const [products, purchases, sales, readings, employees, currentEmployee] = await Promise.all([
    prisma.fuelProduct.findMany({ where: { unitId: unit.id, isActive: true }, orderBy: { name: 'asc' } }),
    prisma.fuelPurchase.findMany({
      where: { unitId: unit.id },
      include: { fuelProduct: { select: { name: true } } },
      orderBy: { purchasedAt: 'desc' },
      take: 60,
    }),
    prisma.fuelSale.findMany({
      where: { unitId: unit.id },
      include: { fuelProduct: { select: { name: true } } },
      orderBy: { soldAt: 'desc' },
      take: 60,
    }),
    prisma.fuelStockReading.findMany({
      where: { unitId: unit.id },
      include: { fuelProduct: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 60,
    }),
    prisma.employee.findMany({ where: { primaryUnitId: unit.id, isActive: true }, orderBy: { name: 'asc' } }),
    prisma.employee.findUnique({ where: { userId: session.user.id } }),
  ])

  const log = [
    ...purchases.map((p) => ({
      id: p.id,
      direction: 'IN' as const,
      productName: p.fuelProduct.name,
      liters: Number(p.liters),
      price: Number(p.buyPrice),
      total: Number(p.total),
      shift: p.shift,
      actualStock: p.actualStock !== null ? Number(p.actualStock) : null,
      lossLiters: p.lossLiters !== null ? Number(p.lossLiters) : null,
      note: p.note,
      at: p.purchasedAt.toISOString(),
    })),
    ...sales.map((s) => ({
      id: s.id,
      direction: 'OUT' as const,
      productName: s.fuelProduct.name,
      liters: Number(s.liters),
      price: Number(s.sellPrice),
      total: Number(s.total),
      shift: s.shift,
      actualStock: s.actualStock !== null ? Number(s.actualStock) : null,
      lossLiters: s.lossLiters !== null ? Number(s.lossLiters) : null,
      note: s.note,
      at: s.soldAt.toISOString(),
    })),
    ...readings.map((r) => ({
      id: r.id,
      direction: 'STOK' as const,
      productName: r.fuelProduct.name,
      liters: null,
      price: null,
      total: null,
      shift: r.shift,
      actualStock: Number(r.actualLiters),
      lossLiters: Number(r.lossLiters),
      note: r.type === 'OPENING' ? `Stok Sekarang (Buka)${r.note ? ' — ' + r.note : ''}` : `Stok Sekarang (Tutup)${r.note ? ' — ' + r.note : ''}`,
      at: r.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 80)

  // Operator (STAFF) tidak boleh tahu harga beli — margin/profit rahasia. Jangan kirim
  // buyPrice sama sekali ke browser mereka (bukan cuma disembunyikan di UI) — termasuk di
  // riwayat transaksi Masuk (harga & total-nya = liter × harga beli, jadi ikut disamarkan).
  const isStaff = session.user.role === 'STAFF'
  const safeLog = isStaff
    ? log.map((entry) => (entry.direction === 'IN' ? { ...entry, price: null, total: null } : entry))
    : log

  return {
    role: session.user.role,
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      stock: Number(p.stock),
      buyPrice: isStaff ? 0 : Number(p.buyPrice),
      sellPrice: Number(p.sellPrice),
    })),
    log: safeLog,
    employees: employees.map((e) => ({ id: e.id, name: e.name })),
    currentEmployeeId: currentEmployee?.id ?? null,
  }
}
