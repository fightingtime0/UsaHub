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
    const agg = await prisma.fuelSale.aggregate({
      where: { unitId: unit.id, soldAt: { gte: startOfDay(day), lte: endOfDay(day) } },
      _sum: { total: true, liters: true },
      _count: true,
    })
    return NextResponse.json({
      date: dateParam,
      reportedSales: Number(agg._sum.total ?? 0),
      totalLiters: Number(agg._sum.liters ?? 0),
      saleCount: agg._count,
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
  const agg = await prisma.fuelSale.aggregate({
    where: { unitId: unit.id, soldAt: { gte: startOfDay(day), lte: endOfDay(day) } },
    _sum: { total: true },
  })
  const reportedSales = Number(agg._sum.total ?? 0)
  const deposit = Number(depositAmount)
  const difference = deposit - reportedSales

  try {
    const recon = await prisma.fuelReconciliation.create({
      data: {
        date: day,
        reportedSales,
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
