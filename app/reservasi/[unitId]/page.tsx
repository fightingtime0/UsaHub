import { prisma } from '@/lib/prisma'
import { ReservasiForm } from './_components/reservasi-form'

// Halaman PUBLIK — rombongan travel memesan tempat lewat link/QR, tanpa login.
// Sejajar dengan /order/[unitId]/[table] milik restoran, tapi untuk reservasi.
export default async function ReservasiPublikPage({ params }: { params: Promise<{ unitId: string }> }) {
  const { unitId } = await params

  const unit = await prisma.businessUnit.findUnique({ where: { id: unitId } })
  if (!unit || unit.type !== 'KOPI_TELO' || !unit.isActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <p className="text-gray-500">Tempat reservasi tidak ditemukan.</p>
      </div>
    )
  }

  const paket = await prisma.menuItem.findMany({
    where: { unitId: unit.id, isAvailable: true },
    orderBy: { price: 'asc' },
    select: { id: true, name: true, description: true, price: true },
  })

  return (
    <ReservasiForm
      unitId={unit.id}
      unitName={unit.name}
      unitLocation={unit.location}
      operatorPhone={unit.phone}
      paket={paket.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: Number(p.price),
      }))}
    />
  )
}
