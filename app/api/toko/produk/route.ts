import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const search = searchParams.get('search') ?? ''
  const categoryId = searchParams.get('categoryId') ?? undefined
  const lowStock = searchParams.get('lowStock') === 'true'

  const unit = await getTenantUnit(session.user.tenantId!, 'RETAIL')
  if (!unit) return NextResponse.json({ error: 'Unit tidak ditemukan' }, { status: 404 })

  const products = await prisma.product.findMany({
    where: {
      unitId: unit.id,
      isActive: true,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(categoryId && { categoryId }),
      // lowStock: stock <= minStock — handled via raw if needed, here approx
    },
    include: { category: true },
    orderBy: { name: 'asc' },
  })

  // Filter lowStock di aplikasi (Prisma tidak support field comparison)
  const filtered = lowStock
    ? products.filter((p) => Number(p.stock) <= Number(p.minStock))
    : products

  return NextResponse.json(filtered)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !['OWNER', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { name, sku, unit: unitSatuan, costPrice, sellPrice, stock, minStock, categoryId } = body

  if (!name || !unitSatuan || costPrice == null || sellPrice == null) {
    return NextResponse.json({ error: 'Field wajib tidak lengkap' }, { status: 400 })
  }

  const businessUnit = await getTenantUnit(session.user.tenantId!, 'RETAIL')
  if (!businessUnit) return NextResponse.json({ error: 'Unit tidak ditemukan' }, { status: 404 })

  const product = await prisma.$transaction(async (tx) => {
    const prod = await tx.product.create({
      data: {
        name,
        sku: sku || null,
        unit: unitSatuan,
        costPrice,
        sellPrice,
        stock: stock ?? 0,
        minStock: minStock ?? 0,
        unitId: businessUnit.id,
        categoryId: categoryId || null,
      },
      include: { category: true },
    })

    // Catat stock movement awal jika ada stok
    if (Number(stock) > 0) {
      await tx.stockMovement.create({
        data: {
          productId: prod.id,
          type: 'IN',
          qty: stock,
          qtyBefore: 0,
          qtyAfter: stock,
          note: 'Stok awal produk',
          refType: 'Manual',
        },
      })
    }

    return prod
  })

  return NextResponse.json(product, { status: 201 })
}



