import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH /api/toko/pembelian/[id]/terima
// Terima barang: update qtyRecv, tambah stok, ubah status PO
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session || !['OWNER', 'MANAGER', 'STAFF'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  // receivedItems: [{ itemId, qtyRecv }]
  const { receivedItems } = body

  const order = await prisma.purchaseOrder.findUnique({
    where: { id: id },
    include: { items: { include: { product: true } }, unit: { select: { tenantId: true } } },
  })

  if (!order || order.unit.tenantId !== session.user.tenantId) {
    return NextResponse.json({ error: 'PO tidak ditemukan' }, { status: 404 })
  }
  if (order.status === 'RECEIVED' || order.status === 'CANCELLED') {
    return NextResponse.json({ error: 'PO sudah selesai atau dibatalkan' }, { status: 400 })
  }

  await prisma.$transaction(async (tx) => {
    for (const recv of receivedItems) {
      const orderItem = order.items.find((i) => i.id === recv.itemId)
      if (!orderItem) continue

      const qtyRecv = Math.min(Number(recv.qtyRecv), Number(orderItem.qty) - Number(orderItem.qtyRecv))
      if (qtyRecv <= 0) continue

      const qtyBefore = Number(orderItem.product.stock)
      const qtyAfter = qtyBefore + qtyRecv

      // Update qtyRecv di item
      await tx.purchaseOrderItem.update({
        where: { id: recv.itemId },
        data: { qtyRecv: { increment: qtyRecv } },
      })

      // Tambah stok produk
      await tx.product.update({
        where: { id: orderItem.productId },
        data: { stock: { increment: qtyRecv } },
      })

      // Catat movement
      await tx.stockMovement.create({
        data: {
          productId: orderItem.productId,
          type: 'IN',
          qty: qtyRecv,
          qtyBefore,
          qtyAfter,
          refType: 'PurchaseOrder',
          refId: order.id,
          note: `Terima PO ${order.orderNumber}`,
        },
      })
    }

    // Update status PO
    const updatedItems = await tx.purchaseOrderItem.findMany({ where: { orderId: order.id } })
    const allReceived = updatedItems.every((i) => Number(i.qtyRecv) >= Number(i.qty))
    const anyReceived = updatedItems.some((i) => Number(i.qtyRecv) > 0)

    await tx.purchaseOrder.update({
      where: { id: order.id },
      data: {
        status: allReceived ? 'RECEIVED' : anyReceived ? 'PARTIAL' : 'ORDERED',
        receivedAt: allReceived ? new Date() : undefined,
      },
    })
  })

  const updated = await prisma.purchaseOrder.findUnique({
    where: { id: id },
    include: { supplier: true, items: { include: { product: true } } },
  })

  return NextResponse.json(updated)
}



