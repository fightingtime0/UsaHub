import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfMonth } from 'date-fns'

// POST — tandai periode gaji satu unit+bulan LUNAS, atau buka kembali ke DRAFT.
// Data payroll final — hanya OWNER yang boleh mengubah status.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'OWNER') {
    return NextResponse.json({ error: 'Hanya Owner yang bisa mengubah status pembayaran gaji' }, { status: 403 })
  }

  const body = await req.json()
  const { unitId, status } = body
  if (!unitId || !['PAID', 'DRAFT'].includes(status)) {
    return NextResponse.json({ error: 'Field wajib tidak lengkap' }, { status: 400 })
  }
  const monthDate = new Date(`${body.month}-01`)
  if (!body.month || isNaN(monthDate.getTime())) {
    return NextResponse.json({ error: 'Bulan tidak valid' }, { status: 400 })
  }
  const month = startOfMonth(monthDate)

  const unit = await prisma.businessUnit.findUnique({ where: { id: unitId } })
  if (!unit || unit.tenantId !== session.user.tenantId) {
    return NextResponse.json({ error: 'Unit tidak ditemukan' }, { status: 404 })
  }

  const period = await prisma.payrollPeriod.upsert({
    where: { unitId_month: { unitId, month } },
    create: { unitId, month, status, paidAt: status === 'PAID' ? new Date() : null },
    update: { status, paidAt: status === 'PAID' ? new Date() : null },
  })

  return NextResponse.json(period)
}
