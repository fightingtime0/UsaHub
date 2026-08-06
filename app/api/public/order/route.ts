import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateInvoiceNumber } from '@/lib/utils'

// ============================================================
// API PUBLIK — order dari QR meja (tanpa login).
// Pembayaran TIDAK ada di sini — hanya kasir yang memproses bayar.
// ============================================================

const MAX_QTY_PER_ITEM = 20
const MAX_ITEMS_PER_REQUEST = 20

// GET ?unitId=...&table=N — order aktif meja tsb (untuk pengunjung melihat pesanannya)
export async function GET(req: NextRequest) {
  const unitId = req.nextUrl.searchParams.get('unitId')
  const table = req.nextUrl.searchParams.get('table')
  if (!unitId) return NextResponse.json({ error: 'Parameter unitId diperlukan' }, { status: 400 })
  if (!table) return NextResponse.json({ error: 'Parameter table diperlukan' }, { status: 400 })

  const unit = await prisma.businessUnit.findUnique({ where: { id: unitId } })
  if (!unit || unit.type !== 'RESTAURANT' || !unit.isActive) {
    return NextResponse.json({ error: 'Restoran tidak ditemukan' }, { status: 404 })
  }

  const order = await prisma.tableOrder.findFirst({
    where: { unitId: unit.id, tableNumber: table, status: { in: ['OPEN', 'BILLED'] } },
    include: {
      items: {
        where: { status: { not: 'CANCELLED' } },
        include: { menuItem: { select: { name: true } } },
        orderBy: { id: 'asc' },
      },
    },
  })

  if (!order) return NextResponse.json(null)

  // Hanya data yang aman untuk pengunjung
  return NextResponse.json({
    orderNumber: order.orderNumber,
    tableNumber: order.tableNumber,
    status: order.status,
    subtotal: Number(order.subtotal),
    tax: Number(order.tax),
    total: Number(order.total),
    items: order.items.map((i) => ({
      name: i.menuItem.name,
      qty: i.qty,
      price: Number(i.price),
      subtotal: Number(i.subtotal),
      note: i.note,
      status: i.status,
    })),
  })
}

// POST — kirim pesanan dari QR meja
// body: { tableNumber, items: [{ menuItemId, qty, note? }] }
export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 })
  }

  const { unitId, tableNumber, items } = body
  if (!unitId) {
    return NextResponse.json({ error: 'Parameter unitId diperlukan' }, { status: 400 })
  }
  if (!tableNumber || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Nomor meja dan item pesanan wajib diisi' }, { status: 400 })
  }
  if (items.length > MAX_ITEMS_PER_REQUEST) {
    return NextResponse.json({ error: 'Terlalu banyak item dalam satu pesanan' }, { status: 400 })
  }

  const unit = await prisma.businessUnit.findUnique({ where: { id: unitId } })
  if (!unit || unit.type !== 'RESTAURANT' || !unit.isActive) {
    return NextResponse.json({ error: 'Restoran tidak ditemukan' }, { status: 404 })
  }

  // Validasi semua menu item
  const menuIds = items.map((i: any) => i.menuItemId)
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuIds }, unitId: unit.id, isAvailable: true },
  })
  const menuMap = new Map(menuItems.map((m) => [m.id, m]))

  for (const it of items) {
    const menu = menuMap.get(it.menuItemId)
    if (!menu) {
      return NextResponse.json({ error: 'Ada menu yang tidak tersedia. Muat ulang halaman.' }, { status: 400 })
    }
    const qty = Number(it.qty)
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_ITEM) {
      return NextResponse.json({ error: `Jumlah tidak valid untuk ${menu.name}` }, { status: 400 })
    }
  }

  // Cari order aktif meja ini, atau buat baru (source: QR)
  let order = await prisma.tableOrder.findFirst({
    where: { unitId: unit.id, tableNumber: String(tableNumber), status: { in: ['OPEN', 'BILLED'] } },
  })

  if (order && order.status === 'BILLED') {
    return NextResponse.json(
      { error: 'Meja ini sedang dalam proses pembayaran. Silakan hubungi kasir.' },
      { status: 409 }
    )
  }

  if (!order) {
    order = await prisma.tableOrder.create({
      data: {
        orderNumber: generateInvoiceNumber('ORD'),
        tableNumber: String(tableNumber),
        status: 'OPEN',
        source: 'QR',
        taxRate: Number(unit.taxRate),
        unitId: unit.id,
      },
    })
  }

  // Tambah item (selalu baris baru dengan status PENDING agar dapur melihat pesanan baru)
  await prisma.tableOrderItem.createMany({
    data: items.map((it: any) => {
      const menu = menuMap.get(it.menuItemId)!
      const qty = Number(it.qty)
      return {
        orderId: order!.id,
        menuItemId: it.menuItemId,
        qty,
        price: menu.price,
        subtotal: Number(menu.price) * qty,
        note: typeof it.note === 'string' && it.note.trim() ? it.note.trim().slice(0, 200) : null,
        status: 'PENDING',
      }
    }),
  })

  // Recalculate totals
  const full = await prisma.tableOrder.findUnique({
    where: { id: order.id },
    include: { items: true },
  })
  if (full) {
    const activeItems = full.items.filter((i) => i.status !== 'CANCELLED')
    const subtotal = activeItems.reduce((s, i) => s + Number(i.subtotal), 0)
    const tax = Math.round((subtotal * Number(full.taxRate)) / 100)
    await prisma.tableOrder.update({
      where: { id: order.id },
      data: { subtotal, tax, total: subtotal + tax },
    })
  }

  return NextResponse.json(
    { success: true, orderNumber: order.orderNumber, tableNumber: order.tableNumber },
    { status: 201 }
  )
}
