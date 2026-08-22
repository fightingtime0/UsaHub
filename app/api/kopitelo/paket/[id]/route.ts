import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'

async function ambilMilikTenant(id: string, tenantId: string) {
  const unit = await getTenantUnit(tenantId, 'KOPI_TELO')
  if (!unit) return null
  return prisma.menuItem.findFirst({ where: { id, unitId: unit.id } })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Hanya Owner/Manager yang bisa mengubah paket' }, { status: 403 })
  }

  const paket = await ambilMilikTenant(id, session.user.tenantId!)
  if (!paket) return NextResponse.json({ error: 'Paket tidak ditemukan' }, { status: 404 })

  const { name, description, price, isAvailable } = await req.json()
  if (price !== undefined && Number(price) < 0) {
    return NextResponse.json({ error: 'Harga tidak boleh negatif' }, { status: 400 })
  }

  const updated = await prisma.menuItem.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: String(name).trim() }),
      ...(description !== undefined && { description: description ? String(description).trim() : null }),
      ...(price !== undefined && { price: Number(price) }),
      ...(isAvailable !== undefined && { isAvailable: Boolean(isAvailable) }),
    },
  })
  return NextResponse.json(updated)
}

// DELETE — nonaktifkan paket, bukan hapus baris. Reservasi lama menyimpan nama & harga
// paket sebagai salinan (menuType/pricePerPax), tapi baris menu tetap dibiarkan
// agar tidak ada relasi yang menggantung.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Hanya Owner/Manager yang bisa mengubah paket' }, { status: 403 })
  }

  const paket = await ambilMilikTenant(id, session.user.tenantId!)
  if (!paket) return NextResponse.json({ error: 'Paket tidak ditemukan' }, { status: 404 })

  const updated = await prisma.menuItem.update({ where: { id }, data: { isAvailable: false } })
  return NextResponse.json(updated)
}
