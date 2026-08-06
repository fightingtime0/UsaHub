import { NextRequest, NextResponse } from 'next/server'
import { getSession, hasUnitAccess } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay } from 'date-fns'

// GET — riwayat rekonsiliasi setoran
// ?date=YYYY-MM-DD → preview total laporan jualan tanggal tsb (untuk form)
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasUnitAccess(session, 'PERTASHOP')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const unit = await prisma.businessUnit.findFirst({ where: { type: 'PERTASHOP', isActive: true } })
  if (!unit) return NextResponse.json({ error: 'Unit Pertashop tidak ditemukan' }, { status: 404 })

  const dateParam = req.nextUrl.searchParams.get('date')
  if (dateParam) {
    const day = new Date(dateParam)
    const [agg, expenseAgg] = await Promise.all([
      prisma.fuelSale.aggregate({
        where: { unitId: unit.id, soldAt: { gte: startOfDay(day), lte: endOfDay(day) } },
        _sum: { total: true, liters: true },
        _count: true,
      }),
      prisma.fuelExpense.aggregate({
        where: { unitId: unit.id, date: { gte: startOfDay(day), lte: endOfDay(day) } },
        _sum: { amount: true },
      }),
    ])
    const reportedSales = Number(agg._sum.total ?? 0)
    const totalExpenses = Number(expenseAgg._sum.amount ?? 0)
    return NextResponse.json({
      date: dateParam,
      reportedSales,
      totalLiters: Number(agg._sum.liters ?? 0),
      saleCount: agg._count,
      totalExpenses,
      netExpected: reportedSales - totalExpenses,
    })
  }

  const items = await prisma.fuelReconciliation.findMany({
    where: { unitId: unit.id },
    orderBy: { date: 'desc' },
    take: 60,
  })

  return NextResponse.json(items)
}

// POST — catat rekonsiliasi: setoran uang vs total laporan hasil jualan hari itu
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasUnitAccess(session, 'PERTASHOP')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { date, depositAmount, note } = body

  if (!date || depositAmount === undefined) {
    return NextResponse.json({ error: 'Tanggal dan jumlah setoran wajib diisi' }, { status: 400 })
  }

  const unit = await prisma.businessUnit.findFirst({ where: { type: 'PERTASHOP', isActive: true } })
  if (!unit) return NextResponse.json({ error: 'Unit Pertashop tidak ditemukan' }, { status: 404 })

  const day = new Date(date)
  const [agg, expenseAgg] = await Promise.all([
    prisma.fuelSale.aggregate({
      where: { unitId: unit.id, soldAt: { gte: startOfDay(day), lte: endOfDay(day) } },
      _sum: { total: true },
    }),
    prisma.fuelExpense.aggregate({
      where: { unitId: unit.id, date: { gte: startOfDay(day), lte: endOfDay(day) } },
      _sum: { amount: true },
    }),
  ])
  const reportedSales = Number(agg._sum.total ?? 0)
  const expenseAmount = Number(expenseAgg._sum.amount ?? 0)
  const deposit = Number(depositAmount)
  // Setoran seharusnya = laporan jualan − biaya pengeluaran (diambil langsung dari uang jualan)
  const difference = deposit - (reportedSales - expenseAmount)

  try {
    const recon = await prisma.fuelReconciliation.create({
      data: {
        date: day,
        reportedSales,
        expenseAmount,
        depositAmount: deposit,
        difference,
        note: note ?? null,
        unitId: unit.id,
      },
    })
    return NextResponse.json(recon, { status: 201 })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'Rekonsiliasi untuk tanggal ini sudah dicatat' }, { status: 409 })
    }
    throw e
  }
}
