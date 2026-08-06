import { NextRequest, NextResponse } from 'next/server'
import { getSession, hasUnitAccess } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay } from 'date-fns'

// GET — riwayat biaya pengeluaran.
// ?date=YYYY-MM-DD → hanya pengeluaran tanggal itu (dipakai form rekonsiliasi/shift)
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasUnitAccess(session, 'PERTASHOP')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const unit = await prisma.businessUnit.findFirst({ where: { type: 'PERTASHOP', isActive: true } })
  if (!unit) return NextResponse.json({ error: 'Unit Pertashop tidak ditemukan' }, { status: 404 })

  const dateParam = req.nextUrl.searchParams.get('date')
  const day = dateParam ? new Date(dateParam) : null

  const expenses = await prisma.fuelExpense.findMany({
    where: { unitId: unit.id, ...(day ? { date: { gte: startOfDay(day), lte: endOfDay(day) } } : {}) },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: day ? undefined : 100,
  })

  return NextResponse.json(expenses)
}

// POST — catat biaya pengeluaran tunai (mis. beli oli, parkir, dll) yang diambil
// dari uang hasil jualan shift itu, sehingga mengurangi jumlah yang harus disetor.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasUnitAccess(session, 'PERTASHOP')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { date, shift, amount, description } = body

  if (!date || amount === undefined || !description) {
    return NextResponse.json({ error: 'Tanggal, jumlah, dan keterangan wajib diisi' }, { status: 400 })
  }
  if (Number(amount) <= 0) {
    return NextResponse.json({ error: 'Jumlah harus lebih dari 0' }, { status: 400 })
  }

  const unit = await prisma.businessUnit.findFirst({ where: { type: 'PERTASHOP', isActive: true } })
  if (!unit) return NextResponse.json({ error: 'Unit Pertashop tidak ditemukan' }, { status: 404 })

  const expense = await prisma.fuelExpense.create({
    data: {
      date: new Date(date),
      shift: shift || null,
      amount: Number(amount),
      description,
      unitId: unit.id,
    },
  })

  return NextResponse.json(expense, { status: 201 })
}

// DELETE — hapus satu entri biaya pengeluaran (mis. salah input).
export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasUnitAccess(session, 'PERTASHOP')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 })

  const unit = await prisma.businessUnit.findFirst({ where: { type: 'PERTASHOP', isActive: true } })
  if (!unit) return NextResponse.json({ error: 'Unit Pertashop tidak ditemukan' }, { status: 404 })

  const expense = await prisma.fuelExpense.findUnique({ where: { id } })
  if (!expense || expense.unitId !== unit.id) {
    return NextResponse.json({ error: 'Pengeluaran tidak ditemukan' }, { status: 404 })
  }

  await prisma.fuelExpense.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
