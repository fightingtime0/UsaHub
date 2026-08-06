import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const categoryId = searchParams.get('categoryId') ?? undefined
  const search = searchParams.get('search') ?? ''

  const unit = await getTenantUnit(session.user.tenantId!, 'RESTAURANT')
  if (!unit) return NextResponse.json({ error: 'Unit tidak ditemukan' }, { status: 404 })

  const menus = await prisma.menuItem.findMany({
    where: {
      unitId: unit.id,
      ...(categoryId && { menuCategoryId: categoryId }),
      ...(search && { name: { contains: search, mode: 'insensitive' } }),
    },
    include: {
      menuCategory: true,
      ingredients: { include: { product: { select: { id: true, name: true, unit: true } } } },
    },
    orderBy: [{ menuCategoryId: 'asc' }, { name: 'asc' }],
  })

  return NextResponse.json(menus)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !['OWNER', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { name, description, price, taxRate, menuCategoryId, isAvailable = true, ingredients = [] } = body

  if (!name || price == null) {
    return NextResponse.json({ error: 'Nama dan harga wajib diisi' }, { status: 400 })
  }

  const unit = await getTenantUnit(session.user.tenantId!, 'RESTAURANT')
  if (!unit) return NextResponse.json({ error: 'Unit tidak ditemukan' }, { status: 404 })

  const menuItem = await prisma.menuItem.create({
    data: {
      name,
      description: description ?? null,
      price,
      taxRate: taxRate ?? Number(unit.taxRate),
      isAvailable,
      unitId: unit.id,
      menuCategoryId: menuCategoryId ?? null,
      ingredients: {
        create: ingredients.map((ing: { productId: string; qtyUsed: number }) => ({
          productId: ing.productId,
          qtyUsed: ing.qtyUsed,
        })),
      },
    },
    include: {
      menuCategory: true,
      ingredients: { include: { product: { select: { id: true, name: true, unit: true } } } },
    },
  })

  return NextResponse.json(menuItem, { status: 201 })
}



