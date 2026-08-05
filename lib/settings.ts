import { prisma } from './prisma'

const DEFAULT_SITE_NAME = 'Bisnis Terpadu'

export async function getSiteName(): Promise<string> {
  const settings = await prisma.appSettings.findUnique({ where: { id: 'singleton' } })
  return settings?.siteName ?? DEFAULT_SITE_NAME
}
