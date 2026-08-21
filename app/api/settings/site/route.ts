import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH — ganti nama tenant (judul tab browser, nama di sidebar). Khusus OWNER,
// dan hanya menyentuh tenant milik sesi ini.
export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'OWNER') {
    return NextResponse.json({ error: 'Hanya Owner yang bisa mengubah pengaturan aplikasi' }, { status: 403 })
  }
  const tenantId = session.user.tenantId
  if (!tenantId) return NextResponse.json({ error: 'Sesi ini tidak terikat tenant manapun' }, { status: 400 })

  const body = await req.json()
  const siteName = typeof body.siteName === 'string' ? body.siteName.trim() : ''
  if (!siteName) return NextResponse.json({ error: 'Nama aplikasi tidak boleh kosong' }, { status: 400 })

  const tenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: { name: siteName },
    select: { name: true },
  })

  return NextResponse.json({ success: true, siteName: tenant.name })
}
