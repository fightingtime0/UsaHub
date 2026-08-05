import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
  const employee = await prisma.employee.update({
    where: { id: id },
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
    include: { primaryUnit: { select: { name: true, type: true } } },
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



