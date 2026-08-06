import { prisma } from '@/lib/prisma'
import { QrOrderClient } from './_components/qr-order-client'

// Halaman PUBLIK — pengunjung memesan lewat scan QR di meja.
// Tidak ada login & tidak ada pembayaran di sini (bayar tetap di kasir).
export default async function QrOrderPage({ params }: { params: Promise<{ unitId: string; table: string }> }) {
  const { unitId, table } = await params
  const tableNumber = decodeURIComponent(table)

  const unit = await prisma.businessUnit.findUnique({ where: { id: unitId } })
  if (!unit || unit.type !== 'RESTAURANT' || !unit.isActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <p className="text-gray-500">Restoran tidak ditemukan.</p>
      </div>
    )
  }

  const menuItems = await prisma.menuItem.findMany({
    where: { unitId: unit.id, isAvailable: true },
    include: { menuCategory: { select: { name: true } } },
    orderBy: { name: 'asc' },
  })

  return (
    <QrOrderClient
      unitId={unit.id}
      restaurantName={unit.name}
      tableNumber={tableNumber}
      menuItems={menuItems.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        price: Number(m.price),
        imageUrl: m.imageUrl,
        category: m.menuCategory?.name ?? 'Lainnya',
      }))}
    />
  )
}
