import { NextRequest, NextResponse } from 'next/server'
import { getSession, hasUnitAccess } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateInvoiceNumber } from '@/lib/utils'
import { startOfDay, endOfDay } from 'date-fns'

// Ukuran DO (tangki pengiriman) dihitung otomatis dari jumlah liter belanja, mis. 2000 L ≈ "2K".
function deriveDoSize(liters: number): string | null {
  const k = Math.round(liters / 1000)
  return k > 0 ? `${k}K` : null
}

// Gabungkan tanggal laporan yang dipilih dengan jam saat ini, supaya beberapa entri di
// tanggal yang sama tetap terurut kronologis (bukan semua tercatat jam 00.00).
function combineDateWithNow(dateStr: string): Date {
  const d = new Date(dateStr)
  const now = new Date()
  d.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds())
  return d
}

// POST — simpan satu "Laporan Shift" secara atomik: transaksi (belanja/jual/stok),
// daftar biaya pengeluaran, dan rekonsiliasi setoran (jika diisi) — dalam satu transaksi DB,
// supaya tidak ada state setengah-tersimpan (mis. pengeluaran tercatat tapi setoran gagal).
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasUnitAccess(session, 'PERTASHOP')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const {
    fuelProductId,
    direction,
    date,
    shift,
    employeeId,
    liters,
    price,
    readingType,
    actualStock,
    expenses,
    depositAmount,
    note,
  } = body

  if (!fuelProductId) return NextResponse.json({ error: 'Produk BBM wajib dipilih' }, { status: 400 })
  if (!['IN', 'OUT', 'STOK'].includes(direction)) {
    return NextResponse.json({ error: 'Jenis transaksi tidak valid' }, { status: 400 })
  }
  if (!date) return NextResponse.json({ error: 'Tanggal wajib diisi' }, { status: 400 })
  if (!shift) return NextResponse.json({ error: 'Shift wajib dipilih' }, { status: 400 })
  if (actualStock === undefined || actualStock === null || actualStock === '') {
    return NextResponse.json({ error: 'Stok sekarang (hasil ukur tangki) wajib diisi' }, { status: 400 })
  }
  if (Number(actualStock) < 0) {
    return NextResponse.json({ error: 'Stok sekarang tidak boleh negatif' }, { status: 400 })
  }

  if (direction !== 'STOK') {
    if (!liters || Number(liters) <= 0) {
      return NextResponse.json({ error: 'Jumlah liter harus lebih dari 0' }, { status: 400 })
    }
    if (direction === 'IN' && (!price || Number(price) <= 0)) {
      return NextResponse.json({ error: 'Harga beli harus lebih dari 0' }, { status: 400 })
    }
  } else if (!['OPENING', 'CLOSING'].includes(readingType)) {
    return NextResponse.json({ error: 'Jenis pengukuran stok tidak valid' }, { status: 400 })
  }

  const expenseList: { amount: number; description: string }[] = Array.isArray(expenses)
    ? expenses
        .filter((e: any) => e && Number(e.amount) > 0 && typeof e.description === 'string' && e.description.trim())
        .map((e: any) => ({ amount: Number(e.amount), description: String(e.description).trim() }))
    : []

  if (depositAmount !== undefined && depositAmount !== null && depositAmount !== '' && Number(depositAmount) < 0) {
    return NextResponse.json({ error: 'Setoran tidak boleh negatif' }, { status: 400 })
  }

  const product = await prisma.fuelProduct.findUnique({
    where: { id: fuelProductId },
    include: { unit: { select: { tenantId: true } } },
  })
  if (!product || !product.isActive || product.unit.tenantId !== session.user.tenantId) {
    return NextResponse.json({ error: 'Produk BBM tidak ditemukan' }, { status: 404 })
  }

  const dateOnly = new Date(date)
  const timestamped = combineDateWithNow(date)
  const actual = Number(actualStock)
  const empId = employeeId || null
  const reportNote = note || null

  try {
    const result = await prisma.$transaction(async (tx) => {
      let movement: unknown

      if (direction === 'IN') {
        const litersNum = Number(liters)
        const buyPrice = Number(price)
        const total = litersNum * buyPrice
        const expectedStock = Number(product.stock) + litersNum
        const lossLiters = expectedStock - actual

        movement = await tx.fuelPurchase.create({
          data: {
            purchaseNumber: generateInvoiceNumber('FBL'),
            liters: litersNum,
            buyPrice,
            total,
            doSize: deriveDoSize(litersNum),
            shift,
            expectedStock,
            actualStock: actual,
            lossLiters,
            note: reportNote,
            purchasedAt: timestamped,
            fuelProductId,
            unitId: product.unitId,
            employeeId: empId,
          },
        })
        await tx.fuelProduct.update({ where: { id: fuelProductId }, data: { stock: actual, buyPrice } })
      } else if (direction === 'OUT') {
        const litersNum = Number(liters)
        const sellPrice = price ? Number(price) : Number(product.sellPrice)
        const buyPrice = Number(product.buyPrice)
        const total = litersNum * sellPrice
        const margin = litersNum * (sellPrice - buyPrice)
        const expectedStock = Number(product.stock) - litersNum
        const lossLiters = expectedStock - actual

        movement = await tx.fuelSale.create({
          data: {
            saleNumber: generateInvoiceNumber('FJL'),
            liters: litersNum,
            sellPrice,
            buyPrice,
            total,
            margin,
            shift,
            expectedStock,
            actualStock: actual,
            lossLiters,
            note: reportNote,
            soldAt: timestamped,
            fuelProductId,
            unitId: product.unitId,
            employeeId: empId,
          },
        })
        await tx.fuelProduct.update({ where: { id: fuelProductId }, data: { stock: actual } })
      } else {
        const expected = Number(product.stock)
        const loss = expected - actual

        movement = await tx.fuelStockReading.create({
          data: {
            type: readingType,
            date: dateOnly,
            expectedLiters: expected,
            actualLiters: actual,
            lossLiters: loss,
            shift,
            note: reportNote,
            fuelProductId,
            unitId: product.unitId,
            employeeId: empId,
          },
        })
        await tx.fuelProduct.update({ where: { id: fuelProductId }, data: { stock: actual } })
      }

      if (expenseList.length > 0) {
        await tx.fuelExpense.createMany({
          data: expenseList.map((e) => ({
            date: dateOnly,
            shift,
            amount: e.amount,
            description: e.description,
            unitId: product.unitId,
            employeeId: empId,
          })),
        })
      }

      let reconciliation = null
      if (depositAmount !== undefined && depositAmount !== null && depositAmount !== '') {
        const [salesAgg, expenseAgg] = await Promise.all([
          tx.fuelSale.aggregate({
            where: { unitId: product.unitId, shift, soldAt: { gte: startOfDay(dateOnly), lte: endOfDay(dateOnly) } },
            _sum: { total: true },
          }),
          tx.fuelExpense.aggregate({
            where: { unitId: product.unitId, shift, date: { gte: startOfDay(dateOnly), lte: endOfDay(dateOnly) } },
            _sum: { amount: true },
          }),
        ])
        const reportedSales = Number(salesAgg._sum.total ?? 0)
        const expenseAmount = Number(expenseAgg._sum.amount ?? 0)
        const deposit = Number(depositAmount)
        const difference = deposit - (reportedSales - expenseAmount)

        reconciliation = await tx.fuelReconciliation.upsert({
          where: { unitId_date_shift: { unitId: product.unitId, date: dateOnly, shift } },
          create: {
            unitId: product.unitId,
            date: dateOnly,
            shift,
            reportedSales,
            expenseAmount,
            depositAmount: deposit,
            difference,
            note: reportNote,
            employeeId: empId,
          },
          update: {
            reportedSales,
            expenseAmount,
            depositAmount: deposit,
            difference,
            note: reportNote,
            employeeId: empId,
          },
        })
      }

      return { movement, expensesAdded: expenseList.length, reconciliation }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Pengukuran untuk produk, tanggal, dan jenis ini sudah dicatat' },
        { status: 409 }
      )
    }
    throw e
  }
}
