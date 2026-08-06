import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH — ganti nama & lokasi unit bisnis (nama toko, homestay, restoran, dll). Khusus OWNER.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'OWNER') {
    return NextResponse.json({ error: 'Hanya Owner yang bisa mengubah unit bisnis' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'Nama tidak boleh kosong' }, { status: 400 })
  const location = typeof body.location === 'string' ? body.location.trim() : ''

  const result = await prisma.businessUnit.updateMany({
    where: { id, tenantId: session.user.tenantId },
    data: { name, location: location || null },
  })
  if (result.count === 0) return NextResponse.json({ error: 'Unit bisnis tidak ditemukan' }, { status: 404 })

  const unit = await prisma.businessUnit.findUnique({ where: { id } })

  return NextResponse.json({ success: true, id: unit!.id, name: unit!.name, location: unit!.location })
}
