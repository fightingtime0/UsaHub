import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { addPayment } from '@/lib/accommodation'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const payment = await addPayment(session.user.tenantId!, {
      bookingId: id,
      amount:    Number(body.amount),
      method:    body.method,
      type:      body.type ?? 'FULL',
      note:      body.note,
    })
    return NextResponse.json(payment, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}



