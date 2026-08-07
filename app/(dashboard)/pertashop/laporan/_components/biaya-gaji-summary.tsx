import Link from 'next/link'
import { formatRupiah } from '@/lib/utils'

// Biaya Gaji kini dihitung otomatis dari modul Gaji terpusat (SDM) — jumlah
// netTotal semua PayrollEntry karyawan unit ini pada bulan tsb. Bacaan saja
// di sini; edit dilakukan di /sdm/gaji.
export function BiayaGajiSummary({ month, unitId, amount, filled }: { month: string; unitId: string; amount: number; filled: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">Biaya Gaji</span>
      <div className="flex items-center gap-2">
        {filled ? (
          <span className="font-medium text-red-600">−{formatRupiah(amount)}</span>
        ) : (
          <span className="text-xs text-amber-600">belum diisi</span>
        )}
        <Link href={`/sdm/gaji?unitId=${unitId}&month=${month}`} className="text-xs text-indigo-600 hover:underline font-medium">
          Kelola
        </Link>
      </div>
    </div>
  )
}
