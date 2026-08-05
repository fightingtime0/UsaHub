import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import bcrypt from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const VALID_ACCOUNT_ROLES = ['STAFF', 'CASHIER', 'MANAGER']

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const unitId = searchParams.get('unitId')
  const q      = searchParams.get('q')

  const employees = await prisma.employee.findMany({
    where: {
      isActive: true,
      ...(unitId ? { primaryUnitId: unitId } : {}),
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
    },
    include: {
      primaryUnit: { select: { name: true, type: true } },
      user: { select: { email: true, role: true } },
      shifts: { orderBy: { date: 'desc' }, take: 5 },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(employees.map((e) => ({
    ...e,
    salary: e.salary ? Number(e.salary) : null,
    shifts: e.shifts.map((s) => ({ ...s })),
  })))
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { name, primaryUnitId, phone, email, address, idNumber, position, salary, joinDate, account } = body

  if (!name || !primaryUnitId) {
    return NextResponse.json({ error: 'Nama dan unit wajib diisi' }, { status: 400 })
  }

  if (account) {
    if (!email) return NextResponse.json({ error: 'Email wajib diisi untuk membuat akun login' }, { status: 400 })
    if (!account.password || account.password.length < 8) {
      return NextResponse.json({ error: 'Password akun minimal 8 karakter' }, { status: 400 })
    }
    if (!VALID_ACCOUNT_ROLES.includes(account.role)) {
      return NextResponse.json({ error: 'Role akun tidak valid' }, { status: 400 })
    }
    // Only OWNER may grant MANAGER-level accounts to avoid privilege escalation via SDM.
    if (account.role === 'MANAGER' && session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Hanya Owner yang bisa membuat akun dengan role Manager' }, { status: 403 })
    }
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return NextResponse.json({ error: 'Email sudah dipakai untuk akun lain' }, { status: 409 })
  }

  const employee = await prisma.$transaction(async (tx) => {
    const created = await tx.employee.create({
      data: {
        name,
        primaryUnitId,
        phone:    phone    ?? null,
        email:    email    ?? null,
        address:  address  ?? null,
        idNumber: idNumber ?? null,
        position: position ?? null,
        salary:   salary   ? Number(salary) : null,
        joinDate: joinDate ? new Date(joinDate) : null,
      },
    })

    if (account) {
      const hashed = await bcrypt.hash(account.password, 10)
      const user = await tx.user.create({
        data: { name, email, password: hashed, role: account.role, primaryUnitId },
      })
      await tx.employee.update({ where: { id: created.id }, data: { userId: user.id } })
    }

    return tx.employee.findUniqueOrThrow({
      where: { id: created.id },
      include: { primaryUnit: { select: { name: true, type: true } }, user: { select: { email: true, role: true } } },
    })
  })

  return NextResponse.json({ ...employee, salary: employee.salary ? Number(employee.salary) : null }, { status: 201 })
}



