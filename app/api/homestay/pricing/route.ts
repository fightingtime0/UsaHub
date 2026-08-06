import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { previewPricing } from '@/lib/accommodation'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const roomId   = searchParams.get('roomId')
  const checkIn  = searchParams.get('checkIn')
  const checkOut = searchParams.get('checkOut')

  if (!roomId || !checkIn || !checkOut) {
    return NextResponse.json({ error: 'roomId, checkIn, checkOut wajib diisi' }, { status: 400 })
  }

  const result = await previewPricing(session.user.tenantId!, roomId, checkIn, checkOut)
  if (!result) return NextResponse.json({ error: 'Kamar tidak ditemukan atau tanggal tidak valid' }, { status: 400 })

  return NextResponse.json(result)
}



