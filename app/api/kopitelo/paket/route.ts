import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'

// Paket makan Kopi Telo = MenuItem milik unit KOPI_TELO, dengan `price` sebagai harga PER ORANG.
// Pakai ulang MenuItem daripada bikin tabel baru — bentuknya identik (nama, deskripsi, harga, aktif).

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const unit = await getTenantUnit(session.user.tenantId!, 'KOPI_TELO')
  if (!unit) return NextResponse.json({ error: 'Unit Kopi Telo tidak ditemukan' }, { status: 404 })

  const paket = await prisma.menuItem.findMany({
    where: { unitId: unit.id },
    orderBy: { price: 'asc' },
  })
  return NextResponse.json(paket)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Hanya Owner/Manager yang bisa mengubah paket' }, { status: 403 })
  }

  const { name, description, price } = await req.json()
  if (!name || price === undefined) {
    return NextResponse.json({ error: 'Nama paket dan harga per orang wajib diisi' }, { status: 400 })
  }
  if (Number(price) < 0) {
    return NextResponse.json({ error: 'Harga tidak boleh negatif' }, { status: 400 })
  }

  const unit = await getTenantUnit(session.user.tenantId!, 'KOPI_TELO')
  if (!unit) return NextResponse.json({ error: 'Unit Kopi Telo tidak ditemukan' }, { status: 404 })

  const paket = await prisma.menuItem.create({
    data: {
      name: String(name).trim(),
      description: description ? String(description).trim() : null,
      price: Number(price),
      unitId: unit.id,
    },
  })
  return NextResponse.json(paket, { status: 201 })
}
