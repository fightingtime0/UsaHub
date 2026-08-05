import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH — ganti nama akun sendiri. Dibatasi OWNER: nama karyawan lain dikelola lewat SDM.
export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'OWNER') {
    return NextResponse.json({ error: 'Hanya Owner yang bisa mengganti nama lewat halaman ini' }, { status: 403 })
  }

  const body = await req.json()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'Nama tidak boleh kosong' }, { status: 400 })

  await prisma.user.update({ where: { id: session.user.id }, data: { name } })

  return NextResponse.json({ success: true, name })
}
