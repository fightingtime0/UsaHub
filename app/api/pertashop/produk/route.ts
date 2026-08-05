import { NextRequest, NextResponse } from 'next/server'
import { getSession, hasUnitAccess } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Membuat produk baru / mengubah harga & status master hanya untuk OWNER & MANAGER —
// STAFF/CASHIER pertashop hanya mencatat transaksi harian (belanja/penjualan), bukan mengubah master harga.
function canManageProduct(session: Awaited<ReturnType<typeof getSession>>) {
  return !!session && hasUnitAccess(session, 'PERTASHOP') && ['OWNER', 'MANAGER'].includes(session.user.role)
}

// GET — semua produk BBM
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasUnitAccess(session, 'PERTASHOP')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const unit = await prisma.businessUnit.findFirst({ where: { type: 'PERTASHOP', isActive: true } })
  if (!unit) return NextResponse.json({ error: 'Unit Pertashop tidak ditemukan' }, { status: 404 })

  const products = await prisma.fuelProduct.findMany({
    where: { unitId: unit.id },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(products)
}

// POST — tambah produk BBM baru
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageProduct(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { name, buyPrice, sellPrice, stock } = body

  if (!name || buyPrice === undefined || sellPrice === undefined) {
    return NextResponse.json({ error: 'Nama, harga beli, dan harga jual wajib diisi' }, { status: 400 })
  }

  const unit = await prisma.businessUnit.findFirst({ where: { type: 'PERTASHOP', isActive: true } })
  if (!unit) return NextResponse.json({ error: 'Unit Pertashop tidak ditemukan' }, { status: 404 })

  const product = await prisma.fuelProduct.create({
    data: {
      name,
      buyPrice: Number(buyPrice),
      sellPrice: Number(sellPrice),
      stock: Number(stock ?? 0),
      unitId: unit.id,
    },
  })

  return NextResponse.json(product, { status: 201 })
}

// PATCH — ubah harga / status produk BBM
export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageProduct(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { id, name, buyPrice, sellPrice, isActive } = body

  if (!id) return NextResponse.json({ error: 'id produk diperlukan' }, { status: 400 })

  const existing = await prisma.fuelProduct.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 })

  const product = await prisma.fuelProduct.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(buyPrice !== undefined && { buyPrice: Number(buyPrice) }),
      ...(sellPrice !== undefined && { sellPrice: Number(sellPrice) }),
      ...(isActive !== undefined && { isActive }),
    },
  })

  return NextResponse.json(product)
}
