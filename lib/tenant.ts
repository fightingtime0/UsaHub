import { prisma } from './prisma'
import type { UnitType } from '@prisma/client'

// Cari BusinessUnit aktif dari jenis tertentu, dilingkupkan ke satu tenant.
// Pengganti wajib untuk pola lama `prisma.businessUnit.findFirst({ where: { type, isActive: true } })`
// yang dulu tidak dilingkupkan (bisa bocor data lintas tenant sebelum multi-tenancy ada).
export function getTenantUnit(tenantId: string, type: UnitType) {
  return prisma.businessUnit.findFirst({ where: { type, isActive: true, tenantId } })
}

// Daftar jenis unit yang aktif untuk satu tenant — dipakai sidebar/overview/laporan supaya
// cuma menampilkan menu/kartu untuk unit yang sungguh dinyalakan tenant ini (bukan asumsi 5 selalu ada).
export async function getActiveUnitTypes(tenantId: string): Promise<UnitType[]> {
  const units = await prisma.businessUnit.findMany({
    where: { tenantId, isActive: true },
    select: { type: true },
  })
  return units.map((u) => u.type)
}
