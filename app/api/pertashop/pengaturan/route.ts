import { NextRequest, NextResponse } from 'next/server'
import { getSession, hasUnitAccess } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'

// GET — pengaturan investasi Pertashop (Investasi Modal, masa manfaat, sewa lahan, mulai operasional).
// Dipakai untuk hitung depresiasi & sewa lahan di Laporan Laba/Rugi.
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasUnitAccess(session, 'PERTASHOP')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const unit = await getTenantUnit(session.user.tenantId!, 'PERTASHOP')
  if (!unit) return NextResponse.json({ error: 'Unit Pertashop tidak ditemukan' }, { status: 404 })

  const settings = await prisma.fuelSettings.findUnique({ where: { unitId: unit.id } })

  return NextResponse.json(
    settings ?? {
      investmentAmount: 0,
      usefulLifeYears: 5,
      landRentPerMonth: 0,
      operationalStartDate: null,
    }
  )
}

// PUT — simpan/perbarui pengaturan investasi. Hanya OWNER/MANAGER (data finansial sensitif).
export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasUnitAccess(session, 'PERTASHOP')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!['OWNER', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Hanya Owner/Manager yang bisa mengubah pengaturan investasi' }, { status: 403 })
  }

  const body = await req.json()
  const { investmentAmount, usefulLifeYears, landRentPerMonth, operationalStartDate } = body

  if (investmentAmount === undefined || usefulLifeYears === undefined || landRentPerMonth === undefined) {
    return NextResponse.json({ error: 'Investasi modal, masa manfaat, dan sewa lahan wajib diisi' }, { status: 400 })
  }
  if (Number(investmentAmount) < 0 || Number(landRentPerMonth) < 0) {
    return NextResponse.json({ error: 'Nilai tidak boleh negatif' }, { status: 400 })
  }
  if (Number(usefulLifeYears) <= 0) {
    return NextResponse.json({ error: 'Masa manfaat harus lebih dari 0 tahun' }, { status: 400 })
  }

  const unit = await getTenantUnit(session.user.tenantId!, 'PERTASHOP')
  if (!unit) return NextResponse.json({ error: 'Unit Pertashop tidak ditemukan' }, { status: 404 })

  const data = {
    investmentAmount: Number(investmentAmount),
    usefulLifeYears: Math.round(Number(usefulLifeYears)),
    landRentPerMonth: Number(landRentPerMonth),
    operationalStartDate: operationalStartDate ? new Date(operationalStartDate) : null,
  }

  const settings = await prisma.fuelSettings.upsert({
    where: { unitId: unit.id },
    create: { ...data, unitId: unit.id },
    update: data,
  })

  return NextResponse.json(settings)
}
