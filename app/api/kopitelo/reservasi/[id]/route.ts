import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTenantUnit } from '@/lib/tenant'

// Reservasi hanya boleh disentuh operator dari tenant pemilik unit Kopi Telo.
// (Rombongan restoran biasa punya route sendiri di /api/restoran/rombongan.)
async function ambilMilikTenant(id: string, tenantId: string) {
  const unit = await getTenantUnit(tenantId, 'KOPI_TELO')
  if (!unit) return null
  return prisma.groupOrder.findFirst({ where: { id, unitId: unit.id } })
}

// PATCH — ubah status / catat pembayaran / koreksi data reservasi
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const reservasi = await ambilMilikTenant(id, session.user.tenantId!)
  if (!reservasi) return NextResponse.json({ error: 'Reservasi tidak ditemukan' }, { status: 404 })

  const body = await req.json()
  const { status, addPayment, pax, menuType, customMenu, pricePerPax, eventDate, travelName, busPo, customerPhone, note } = body

  const newPax = pax !== undefined ? Number(pax) : reservasi.pax
  const newPrice = pricePerPax !== undefined ? Number(pricePerPax) : Number(reservasi.pricePerPax)

  const updated = await prisma.groupOrder.update({
    where: { id },
    data: {
      ...(status !== undefined && { status }),
      ...(pax !== undefined && { pax: newPax }),
      ...(menuType !== undefined && { menuType }),
      ...(customMenu !== undefined && { customMenu }),
      ...(eventDate !== undefined && { eventDate: new Date(eventDate) }),
      ...(travelName !== undefined && { travelName }),
      ...(busPo !== undefined && { busPo }),
      ...(customerPhone !== undefined && { customerPhone }),
      ...(note !== undefined && { note }),
      ...((pax !== undefined || pricePerPax !== undefined) && {
        pricePerPax: newPrice,
        totalPrice: newPax * newPrice,
      }),
      ...(addPayment !== undefined && { paidAmount: Number(reservasi.paidAmount) + Number(addPayment) }),
    },
  })

  return NextResponse.json(updated)
}

// DELETE — batalkan reservasi (soft: set CANCELLED)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const reservasi = await ambilMilikTenant(id, session.user.tenantId!)
  if (!reservasi) return NextResponse.json({ error: 'Reservasi tidak ditemukan' }, { status: 404 })

  const updated = await prisma.groupOrder.update({ where: { id }, data: { status: 'CANCELLED' } })
  return NextResponse.json(updated)
}
