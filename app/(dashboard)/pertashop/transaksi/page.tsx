import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'
import { TransaksiClient } from './_components/transaksi-client'

export default async function TransaksiPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const unit = await getTenantUnit(session.user.tenantId!, 'PERTASHOP')
  if (!unit) return <p className="text-red-500">Unit Pertashop tidak ditemukan.</p>

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

  return (
    <TransaksiClient
      role={session.user.role}
      products={products.map((p) => ({
        id: p.id,
        name: p.name,
        stock: Number(p.stock),
        buyPrice: Number(p.buyPrice),
        sellPrice: Number(p.sellPrice),
      }))}
      log={log}
      employees={employees.map((e) => ({ id: e.id, name: e.name }))}
      currentEmployeeId={currentEmployee?.id ?? null}
    />
  )
}
