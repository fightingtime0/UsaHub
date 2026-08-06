'use client'

import Link from 'next/link'
import { formatRupiah, formatDate } from '@/lib/utils'
import { PengeluaranSetoranPanel } from '../../_components/pengeluaran-setoran-panel'

type ReconLite = {
  id: string
  date: string
  reportedSales: number
  expenseAmount: number
  depositAmount: number
  difference: number
  note: string | null
}

export function RekonsiliasiClient({ recons }: { recons: ReconLite[] }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/pertashop" className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Kembali">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Rekonsiliasi Setoran</h1>
          <p className="text-xs md:text-sm text-gray-500">Cocokkan setoran uang vs laporan hasil jualan</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Form + biaya pengeluaran (sama dengan yang ada di halaman Input Transaksi) */}
        <div className="self-start">
          <PengeluaranSetoranPanel />
        </div>

        {/* Riwayat */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm self-start">
          <div className="px-4 md:px-5 py-3 md:py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm md:text-base">Riwayat Rekonsiliasi</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="px-4 md:px-5 py-2.5 font-medium">Tanggal</th>
                  <th className="px-3 py-2.5 font-medium text-right">Laporan Jualan</th>
                  <th className="px-3 py-2.5 font-medium text-right">Biaya</th>
                  <th className="px-3 py-2.5 font-medium text-right">Setoran</th>
                  <th className="px-4 md:px-5 py-2.5 font-medium text-right">Selisih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recons.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center text-gray-400">Belum ada rekonsiliasi</td>
                  </tr>
                )}
                {recons.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 md:px-5 py-3 text-gray-600 whitespace-nowrap">
                      {formatDate(r.date)}
                      {r.note && <p className="text-xs text-gray-400">{r.note}</p>}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-600">{formatRupiah(r.reportedSales)}</td>
                    <td className="px-3 py-3 text-right text-red-500">{r.expenseAmount > 0 ? `−${formatRupiah(r.expenseAmount)}` : '—'}</td>
                    <td className="px-3 py-3 text-right font-semibold text-gray-900">{formatRupiah(r.depositAmount)}</td>
                    <td
                      className={`px-4 md:px-5 py-3 text-right font-semibold ${
                        r.difference === 0 ? 'text-emerald-600' : r.difference > 0 ? 'text-blue-600' : 'text-red-600'
                      }`}
                    >
                      {r.difference === 0 ? 'Cocok' : `${r.difference > 0 ? '+' : ''}${formatRupiah(r.difference)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
