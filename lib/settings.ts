import { prisma } from './prisma'
import { getSession } from './auth'
import { BRAND_NAME } from './brand'

// Nama yang tampil = nama tenant si pengguna.
// Dulu ini satu baris global (AppSettings id:"singleton"), jadi Owner tenant manapun
// menimpa nama tenant lain. Tenant.name sudah per-tenant, jadi dipakai langsung.
export async function getSiteName(): Promise<string> {
  const session = await getSession()
  const tenantId = session?.user?.tenantId
  if (!tenantId) return BRAND_NAME

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true },
  })
  return tenant?.name.trim() || BRAND_NAME
}
