import { NextRequest, NextResponse } from 'next/server'
import { getSession, hasUnitAccess } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'
import { startOfMonth } from 'date-fns'

// GET — Biaya Gaji bulanan Pertashop (input manual). ?month=YYYY-MM wajib.
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasUnitAccess(session, 'PERTASHOP')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const monthParam = req.nextUrl.searchParams.get('month')
  if (!monthParam) return NextResponse.json({ error: 'Parameter month wajib diisi' }, { status: 400 })

  const unit = await getTenantUnit(session.user.tenantId!, 'PERTASHOP')
  if (!unit) return NextResponse.json({ error: 'Unit Pertashop tidak ditemukan' }, { status: 404 })

  const month = startOfMonth(new Date(`${monthParam}-01`))
  const entry = await prisma.fuelPayrollExpense.findUnique({ where: { unitId_month: { unitId: unit.id, month } } })

  return NextResponse.json({ month: monthParam, amount: entry ? Number(entry.amount) : 0, note: entry?.note ?? null })
}

// POST — simpan/perbarui Biaya Gaji untuk satu bulan (upsert). Hanya OWNER/MANAGER (data payroll sensitif).
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasUnitAccess(session, 'PERTASHOP')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!['OWNER', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Hanya Owner/Manager yang bisa mengisi Biaya Gaji' }, { status: 403 })
  }

  const body = await req.json()
  const { month: monthParam, amount, note } = body

  if (!monthParam || amount === undefined) {
    return NextResponse.json({ error: 'Bulan dan jumlah wajib diisi' }, { status: 400 })
  }
  if (Number(amount) < 0) {
    return NextResponse.json({ error: 'Jumlah tidak boleh negatif' }, { status: 400 })
  }

  const unit = await getTenantUnit(session.user.tenantId!, 'PERTASHOP')
  if (!unit) return NextResponse.json({ error: 'Unit Pertashop tidak ditemukan' }, { status: 404 })

  const month = startOfMonth(new Date(`${monthParam}-01`))
  const entry = await prisma.fuelPayrollExpense.upsert({
    where: { unitId_month: { unitId: unit.id, month } },
    create: { unitId: unit.id, month, amount: Number(amount), note: note ?? null },
    update: { amount: Number(amount), note: note ?? null },
  })

  return NextResponse.json(entry)
}
