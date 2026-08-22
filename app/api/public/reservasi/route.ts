import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateInvoiceNumber } from '@/lib/utils'

// ============================================================
// API PUBLIK — reservasi rombongan Kopi Telo (tanpa login).
// Sejajar dengan /api/public/order milik QR meja restoran:
// pengunjung hanya boleh MEMBUAT reservasi berstatus PENDING.
// Tidak ada pembayaran, tidak ada perubahan status — itu wewenang operator.
// ============================================================

const MAX_PAX = 2000 // rest area besar, tapi tetap ada batas agar form tidak dipakai iseng
const MAX_TEXT = 200

const clean = (v: unknown, max = MAX_TEXT): string | null => {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t.slice(0, max) : null
}

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 })
  }

  const { unitId, menuItemId } = body
  if (!unitId) return NextResponse.json({ error: 'Parameter unitId diperlukan' }, { status: 400 })

  const unit = await prisma.businessUnit.findUnique({ where: { id: unitId } })
  if (!unit || unit.type !== 'KOPI_TELO' || !unit.isActive) {
    return NextResponse.json({ error: 'Tempat reservasi tidak ditemukan' }, { status: 404 })
  }

  const customerName = clean(body.customerName, 100)
  const customerPhone = clean(body.customerPhone, 30)
  const travelName = clean(body.travelName, 100)
  const busPo = clean(body.busPo, 100)
  const customMenu = clean(body.customMenu, 500)
  const pax = Number(body.pax)

  if (!customerName) return NextResponse.json({ error: 'Nama rombongan wajib diisi' }, { status: 400 })
  if (!customerPhone) return NextResponse.json({ error: 'Nomor telepon pemesan wajib diisi' }, { status: 400 })
  if (!Number.isInteger(pax) || pax < 1 || pax > MAX_PAX) {
    return NextResponse.json({ error: 'Jumlah peserta tidak valid' }, { status: 400 })
  }

  const eventDate = new Date(body.eventDate)
  if (isNaN(eventDate.getTime())) {
    return NextResponse.json({ error: 'Tanggal & jam kedatangan tidak valid' }, { status: 400 })
  }
  // Reservasi ke masa lalu hampir pasti salah ketik; beri toleransi 1 jam untuk beda jam device.
  if (eventDate.getTime() < Date.now() - 60 * 60 * 1000) {
    return NextResponse.json({ error: 'Tanggal kedatangan sudah lewat' }, { status: 400 })
  }

  // Harga TIDAK pernah diambil dari body — selalu dari paket milik unit ini,
  // supaya pengunjung tidak bisa mengarang harga per orang.
  const paket = await prisma.menuItem.findFirst({
    where: { id: String(menuItemId ?? ''), unitId: unit.id, isAvailable: true },
  })
  if (!paket) {
    return NextResponse.json({ error: 'Paket menu tidak tersedia. Muat ulang halaman.' }, { status: 400 })
  }

  const pricePerPax = Number(paket.price)
  const reservasi = await prisma.groupOrder.create({
    data: {
      orderCode: generateInvoiceNumber('RSV'),
      customerName,
      customerPhone,
      travelName,
      busPo,
      source: 'WEB',
      eventDate,
      pax,
      menuType: paket.name,
      customMenu,
      pricePerPax,
      totalPrice: pricePerPax * pax,
      status: 'PENDING',
      unitId: unit.id,
    },
  })

  return NextResponse.json(
    {
      success: true,
      orderCode: reservasi.orderCode,
      menuType: reservasi.menuType,
      pricePerPax,
      totalPrice: Number(reservasi.totalPrice),
    },
    { status: 201 }
  )
}
