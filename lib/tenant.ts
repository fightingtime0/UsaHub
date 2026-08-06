import { prisma } from './prisma'
import type { UnitType } from '@prisma/client'

// Cari BusinessUnit aktif dari jenis tertentu, dilingkupkan ke satu tenant.
// Pengganti wajib untuk pola lama `prisma.businessUnit.findFirst({ where: { type, isActive: true } })`
// yang dulu tidak dilingkupkan (bisa bocor data lintas tenant sebelum multi-tenancy ada).
export function getTenantUnit(tenantId: string, type: UnitType) {
  return prisma.businessUnit.findFirst({ where: { type, isActive: true, tenantId } })
}
