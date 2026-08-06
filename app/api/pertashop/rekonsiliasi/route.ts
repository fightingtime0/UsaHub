import { NextRequest, NextResponse } from 'next/server'
import { getSession, hasUnitAccess } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'
import { startOfDay, endOfDay } from 'date-fns'

// GET — riwayat rekonsiliasi setoran
// ?date=YYYY-MM-DD → preview total laporan jualan tanggal tsb (untuk form)
// ?shift= (opsional) → lingkupkan preview ke shift tsb saja, bukan seluruh hari
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasUnitAccess(session, 'PERTASHOP')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const unit = await getTenantUnit(session.user.tenantId!, 'PERTASHOP')
  if (!unit) return NextResponse.json({ error: 'Unit Pertashop tidak ditemukan' }, { status: 404 })

  const dateParam = req.nextUrl.searchParams.get('date')
  const shiftParam = req.nextUrl.searchParams.get('shift')
  if (dateParam) {
    const day = new Date(dateParam)
    const dayRange = { gte: startOfDay(day), lte: endOfDay(day) }
    const [agg, expenseAgg] = await Promise.all([
      prisma.fuelSale.aggregate({
        where: { unitId: unit.id, soldAt: dayRange, ...(shiftParam ? { shift: shiftParam } : {}) },
        _sum: { total: true, liters: true },
        _count: true,
      }),
      prisma.fuelExpense.aggregate({
        where: { unitId: unit.id, date: dayRange, ...(shiftParam ? { shift: shiftParam } : {}) },
        _sum: { amount: true },
      }),
    ])
    const reportedSales = Number(agg._sum.total ?? 0)
    const totalExpenses = Number(expenseAgg._sum.amount ?? 0)
    return NextResponse.json({
      date: dateParam,
      shift: shiftParam ?? null,
      reportedSales,
      totalLiters: Number(agg._sum.liters ?? 0),
      saleCount: agg._count,
      totalExpenses,
      netExpected: reportedSales - totalExpenses,
    })
  }

  const items = await prisma.fuelReconciliation.findMany({
    where: { unitId: unit.id },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: 60,
  })

  return NextResponse.json(items)
}

// POST — catat/perbarui rekonsiliasi: setoran uang vs total laporan hasil jualan
// shift/hari itu. Upsert per (unit, tanggal, shift) — shift null berarti level hari.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasUnitAccess(session, 'PERTASHOP')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { date, shift, depositAmount, note } = body

  if (!date || depositAmount === undefined) {
    return NextResponse.json({ error: 'Tanggal dan jumlah setoran wajib diisi' }, { status: 400 })
  }
  if (Number(depositAmount) < 0) {
    return NextResponse.json({ error: 'Setoran tidak boleh negatif' }, { status: 400 })
  }

  const unit = await getTenantUnit(session.user.tenantId!, 'PERTASHOP')
  if (!unit) return NextResponse.json({ error: 'Unit Pertashop tidak ditemukan' }, { status: 404 })

  const day = new Date(date)
  const dayRange = { gte: startOfDay(day), lte: endOfDay(day) }
  const shiftValue = shift || null
  const [agg, expenseAgg] = await Promise.all([
    prisma.fuelSale.aggregate({
      where: { unitId: unit.id, soldAt: dayRange, ...(shiftValue ? { shift: shiftValue } : {}) },
      _sum: { total: true },
    }),
    prisma.fuelExpense.aggregate({
      where: { unitId: unit.id, date: dayRange, ...(shiftValue ? { shift: shiftValue } : {}) },
      _sum: { amount: true },
    }),
  ])
  const reportedSales = Number(agg._sum.total ?? 0)
  const expenseAmount = Number(expenseAgg._sum.amount ?? 0)
  const deposit = Number(depositAmount)
  // Setoran seharusnya = laporan jualan − biaya pengeluaran (diambil langsung dari uang jualan)
  const difference = deposit - (reportedSales - expenseAmount)

  const recon = await prisma.fuelReconciliation.upsert({
    where: { unitId_date_shift: { unitId: unit.id, date: day, shift: shiftValue } },
    create: {
      date: day,
      shift: shiftValue,
      reportedSales,
      expenseAmount,
      depositAmount: deposit,
      difference,
      note: note ?? null,
      unitId: unit.id,
    },
    update: {
      reportedSales,
      expenseAmount,
      depositAmount: deposit,
      difference,
      note: note ?? null,
    },
  })
  return NextResponse.json(recon, { status: 201 })
}
