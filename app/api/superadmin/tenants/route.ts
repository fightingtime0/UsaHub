import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// POST — buat tenant baru sekaligus akun OWNER pertamanya (SUPERADMIN only).
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SUPERADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { name, ownerName, ownerEmail, ownerPassword } = body

  if (!name || !ownerName || !ownerEmail || !ownerPassword) {
    return NextResponse.json({ error: 'Nama bisnis, nama, email, dan password Owner wajib diisi' }, { status: 400 })
  }
  if (String(ownerPassword).length < 8) {
    return NextResponse.json({ error: 'Password Owner minimal 8 karakter' }, { status: 400 })
  }

  const existingUser = await prisma.user.findUnique({ where: { email: ownerEmail } })
  if (existingUser) return NextResponse.json({ error: 'Email sudah dipakai untuk akun lain' }, { status: 409 })

  const baseSlug = slugify(name) || 'tenant'
  let slug = baseSlug
  let suffix = 1
  while (await prisma.tenant.findUnique({ where: { slug } })) {
    suffix += 1
    slug = `${baseSlug}-${suffix}`
  }

  const hashed = await bcrypt.hash(ownerPassword, 10)

  const tenant = await prisma.$transaction(async (tx) => {
    const created = await tx.tenant.create({ data: { name, slug } })
    await tx.user.create({
      data: {
        name: ownerName,
        email: ownerEmail,
        password: hashed,
        role: 'OWNER',
        tenantId: created.id,
        primaryUnitId: null,
      },
    })
    return created
  })

  return NextResponse.json(tenant, { status: 201 })
}
