import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { UnitType } from '@prisma/client'

const VALID_TYPES: UnitType[] = ['RETAIL', 'HOMESTAY', 'RESTAURANT', 'LODGING', 'PERTASHOP']

// POST — aktifkan (buat) unit bisnis jenis tertentu untuk tenant ini (SUPERADMIN only).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: tenantId } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SUPERADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { type, name, location } = body

  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: 'Jenis unit tidak valid' }, { status: 400 })
  }
  if (!name) return NextResponse.json({ error: 'Nama unit wajib diisi' }, { status: 400 })

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) return NextResponse.json({ error: 'Tenant tidak ditemukan' }, { status: 404 })

  const existing = await prisma.businessUnit.findFirst({ where: { tenantId, type } })
  if (existing) {
    return NextResponse.json({ error: 'Tenant ini sudah punya unit jenis tersebut' }, { status: 409 })
  }

  const unit = await prisma.businessUnit.create({
    data: { name, type, location: location || null, tenantId },
  })
  return NextResponse.json(unit, { status: 201 })
}

// PATCH — toggle aktif/nonaktif dan/atau ganti nama salah satu unit bisnis milik tenant ini.
// Rename unit sengaja cuma bisa dari sini (Superadmin), bukan dari /pengaturan Owner.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: tenantId } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SUPERADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { unitId, isActive, name } = body
  if (!unitId || (typeof isActive !== 'boolean' && typeof name !== 'string')) {
    return NextResponse.json({ error: 'unitId wajib diisi, beserta isActive dan/atau name' }, { status: 400 })
  }

  const data: { isActive?: boolean; name?: string } = {}
  if (typeof isActive === 'boolean') data.isActive = isActive
  if (typeof name === 'string') {
    const trimmed = name.trim()
    if (!trimmed) return NextResponse.json({ error: 'Nama tidak boleh kosong' }, { status: 400 })
    data.name = trimmed
  }

  const result = await prisma.businessUnit.updateMany({
    where: { id: unitId, tenantId },
    data,
  })
  if (result.count === 0) {
    return NextResponse.json({ error: 'Unit tidak ditemukan untuk tenant ini' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
