import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH — ganti nama aplikasi (judul web, brand di sidebar). Khusus OWNER.
export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'OWNER') {
    return NextResponse.json({ error: 'Hanya Owner yang bisa mengubah pengaturan aplikasi' }, { status: 403 })
  }

  const body = await req.json()
  const siteName = typeof body.siteName === 'string' ? body.siteName.trim() : ''
  if (!siteName) return NextResponse.json({ error: 'Nama aplikasi tidak boleh kosong' }, { status: 400 })

  const settings = await prisma.appSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', siteName },
    update: { siteName },
  })

  return NextResponse.json({ success: true, siteName: settings.siteName })
}
