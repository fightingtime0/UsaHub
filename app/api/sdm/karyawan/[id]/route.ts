import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import bcrypt from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const VALID_ACCOUNT_ROLES = ['STAFF', 'CASHIER', 'MANAGER']

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const employee = await prisma.employee.findUnique({
    where: { id: id },
    include: {
      primaryUnit: { select: { id: true, name: true, type: true } },
      user:  { select: { email: true, role: true } },
      shifts: { orderBy: { date: 'desc' }, take: 30 },
    },
  })
  if (!employee) return NextResponse.json({ error: 'Karyawan tidak ditemukan' }, { status: 404 })

  return NextResponse.json({ ...employee, salary: employee.salary ? Number(employee.salary) : null })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session || !['OWNER', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { account } = body

  const existing = await prisma.employee.findUnique({ where: { id }, select: { userId: true } })
  if (!existing) return NextResponse.json({ error: 'Karyawan tidak ditemukan' }, { status: 404 })

  if (account) {
    if (existing.userId) {
      return NextResponse.json({ error: 'Karyawan ini sudah punya akun login' }, { status: 409 })
    }
    if (!body.email) return NextResponse.json({ error: 'Email wajib diisi untuk membuat akun login' }, { status: 400 })
    if (!account.password || account.password.length < 8) {
      return NextResponse.json({ error: 'Password akun minimal 8 karakter' }, { status: 400 })
    }
    if (!VALID_ACCOUNT_ROLES.includes(account.role)) {
      return NextResponse.json({ error: 'Role akun tidak valid' }, { status: 400 })
    }
    if (account.role === 'MANAGER' && session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Hanya Owner yang bisa membuat akun dengan role Manager' }, { status: 403 })
    }
    const existingUser = await prisma.user.findUnique({ where: { email: body.email } })
    if (existingUser) return NextResponse.json({ error: 'Email sudah dipakai untuk akun lain' }, { status: 409 })
  }

  const employee = await prisma.$transaction(async (tx) => {
    const updated = await tx.employee.update({
      where: { id },
      data: {
        name:         body.name,
        primaryUnitId: body.primaryUnitId,
        phone:        body.phone    ?? null,
        email:        body.email    ?? null,
        address:      body.address  ?? null,
        idNumber:     body.idNumber ?? null,
        position:     body.position ?? null,
        salary:       body.salary   ? Number(body.salary) : null,
        joinDate:     body.joinDate ? new Date(body.joinDate) : null,
        isActive:     body.isActive ?? true,
      },
    })

    if (account) {
      const hashed = await bcrypt.hash(account.password, 10)
      const user = await tx.user.create({
        data: { name: body.name, email: body.email, password: hashed, role: account.role, primaryUnitId: body.primaryUnitId },
      })
      await tx.employee.update({ where: { id: updated.id }, data: { userId: user.id } })
    }

    return tx.employee.findUniqueOrThrow({
      where: { id: updated.id },
      include: { primaryUnit: { select: { name: true, type: true } }, user: { select: { email: true, role: true } } },
    })
  })

  return NextResponse.json({ ...employee, salary: employee.salary ? Number(employee.salary) : null })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'OWNER') {
    return NextResponse.json({ error: 'Hanya Owner yang bisa hapus karyawan' }, { status: 403 })
  }

  await prisma.employee.update({ where: { id: id }, data: { isActive: false } })
  return NextResponse.json({ success: true })
}
