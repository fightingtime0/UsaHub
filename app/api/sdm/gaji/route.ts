import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfMonth } from 'date-fns'
import type { PayrollItemType } from '@prisma/client'

function parseMonth(monthParam: string | null): Date | null {
  if (!monthParam) return null
  const d = new Date(`${monthParam}-01`)
  if (isNaN(d.getTime())) return null
  return startOfMonth(d)
}

// GET — daftar gaji semua karyawan aktif di satu unit untuk satu bulan.
// Karyawan yang belum punya PayrollEntry ditampilkan sebagai draft (belum tersimpan)
// dengan baseSalary default dari Employee.salary.
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const unitId = req.nextUrl.searchParams.get('unitId')
  const month = parseMonth(req.nextUrl.searchParams.get('month'))
  if (!unitId || !month) {
    return NextResponse.json({ error: 'Parameter unitId dan month wajib diisi' }, { status: 400 })
  }

  const unit = await prisma.businessUnit.findUnique({ where: { id: unitId } })
  if (!unit || unit.tenantId !== session.user.tenantId) {
    return NextResponse.json({ error: 'Unit tidak ditemukan' }, { status: 404 })
  }

  const [employees, period] = await Promise.all([
    prisma.employee.findMany({
      where: { primaryUnitId: unitId, isActive: true },
      orderBy: { name: 'asc' },
    }),
    prisma.payrollPeriod.findUnique({
      where: { unitId_month: { unitId, month } },
      include: { entries: { include: { items: true } } },
    }),
  ])

  const entries = employees.map((emp) => {
    const existing = period?.entries.find((e) => e.employeeId === emp.id)
    if (existing) {
      return {
        employeeId: emp.id,
        employeeName: emp.name,
        position: emp.position,
        baseSalary: Number(existing.baseSalary),
        totalAdditions: Number(existing.totalAdditions),
        totalDeductions: Number(existing.totalDeductions),
        netTotal: Number(existing.netTotal),
        note: existing.note,
        items: existing.items.map((it) => ({ id: it.id, type: it.type, label: it.label, amount: Number(it.amount) })),
        saved: true,
      }
    }
    const baseSalary = emp.salary ? Number(emp.salary) : 0
    return {
      employeeId: emp.id,
      employeeName: emp.name,
      position: emp.position,
      baseSalary,
      totalAdditions: 0,
      totalDeductions: 0,
      netTotal: baseSalary,
      note: null,
      items: [] as { id: string; type: PayrollItemType; label: string; amount: number }[],
      saved: false,
    }
  })

  return NextResponse.json({
    period: period ? { id: period.id, status: period.status, paidAt: period.paidAt } : null,
    entries,
  })
}

// POST — simpan/perbarui gaji satu karyawan untuk satu bulan (upsert period + entry + items).
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { unitId, employeeId, baseSalary, note } = body
  const month = parseMonth(body.month)
  const items: { type: PayrollItemType; label: string; amount: number }[] = Array.isArray(body.items) ? body.items : []

  if (!unitId || !employeeId || !month || baseSalary == null) {
    return NextResponse.json({ error: 'Field wajib tidak lengkap' }, { status: 400 })
  }
  for (const it of items) {
    if (!it.label || !['TAMBAHAN', 'POTONGAN'].includes(it.type) || Number(it.amount) < 0) {
      return NextResponse.json({ error: 'Item tambahan/potongan tidak valid' }, { status: 400 })
    }
  }

  const unit = await prisma.businessUnit.findUnique({ where: { id: unitId } })
  if (!unit || unit.tenantId !== session.user.tenantId) {
    return NextResponse.json({ error: 'Unit tidak ditemukan' }, { status: 404 })
  }
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
  if (!employee || employee.primaryUnitId !== unitId) {
    return NextResponse.json({ error: 'Karyawan tidak ditemukan di unit ini' }, { status: 404 })
  }

  const existingPeriod = await prisma.payrollPeriod.findUnique({ where: { unitId_month: { unitId, month } } })
  if (existingPeriod?.status === 'PAID') {
    return NextResponse.json({ error: 'Periode ini sudah ditandai lunas — buka kembali dulu untuk mengubah' }, { status: 409 })
  }

  const totalAdditions = items.filter((i) => i.type === 'TAMBAHAN').reduce((s, i) => s + Number(i.amount), 0)
  const totalDeductions = items.filter((i) => i.type === 'POTONGAN').reduce((s, i) => s + Number(i.amount), 0)
  const netTotal = Number(baseSalary) + totalAdditions - totalDeductions

  const entry = await prisma.$transaction(async (tx) => {
    const period = await tx.payrollPeriod.upsert({
      where: { unitId_month: { unitId, month } },
      create: { unitId, month },
      update: {},
    })

    const existingEntry = await tx.payrollEntry.findUnique({
      where: { periodId_employeeId: { periodId: period.id, employeeId } },
    })

    const saved = await tx.payrollEntry.upsert({
      where: { periodId_employeeId: { periodId: period.id, employeeId } },
      create: {
        periodId: period.id,
        employeeId,
        baseSalary,
        totalAdditions,
        totalDeductions,
        netTotal,
        note: note || null,
      },
      update: { baseSalary, totalAdditions, totalDeductions, netTotal, note: note || null },
    })

    if (existingEntry) {
      await tx.payrollItem.deleteMany({ where: { entryId: existingEntry.id } })
    }
    if (items.length > 0) {
      await tx.payrollItem.createMany({
        data: items.map((it) => ({ entryId: saved.id, type: it.type, label: it.label, amount: it.amount })),
      })
    }

    return tx.payrollEntry.findUnique({ where: { id: saved.id }, include: { items: true } })
  })

  return NextResponse.json(entry)
}
