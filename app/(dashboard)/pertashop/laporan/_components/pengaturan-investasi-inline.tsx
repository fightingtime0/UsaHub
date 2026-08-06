'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatRupiah } from '@/lib/utils'

type Settings = {
  investmentAmount: number
  usefulLifeYears: number
  landRentPerMonth: number
  operationalStartDate: string | null
}

function toDateInputValue(iso: string | null) {
  if (!iso) return ''
  return iso.slice(0, 10)
}

// Pengaturan investasi (satu kali isi, bisa diubah kapan saja) — dipakai untuk
// hitung Depresiasi/bulan & Biaya Sewa Lahan di Laporan Laba/Rugi setiap bulan.
export function PengaturanInvestasiInline({
  settings,
  computed,
}: {
  settings: Settings
  computed: { depresiasiPerTahun: number; depresiasiPerBulan: number; sisaPenyusutan: number }
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [investmentAmount, setInvestmentAmount] = useState(String(settings.investmentAmount))
  const [usefulLifeYears, setUsefulLifeYears] = useState(String(settings.usefulLifeYears))
  const [landRentPerMonth, setLandRentPerMonth] = useState(String(settings.landRentPerMonth))
  const [operationalStartDate, setOperationalStartDate] = useState(toDateInputValue(settings.operationalStartDate))

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/pertashop/pengaturan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          investmentAmount: parseFloat(investmentAmount) || 0,
          usefulLifeYears: parseInt(usefulLifeYears, 10) || 1,
          landRentPerMonth: parseFloat(landRentPerMonth) || 0,
          operationalStartDate: operationalStartDate || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error ?? 'Gagal menyimpan pengaturan investasi')
        return
      }
      setEditing(false)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  if (editing) {
    return (
      <form onSubmit={handleSave} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-5 space-y-3">
        <h2 className="font-semibold text-gray-900 text-sm md:text-base">Pengaturan Investasi</h2>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Investasi Modal (Rp)</label>
          <input
            type="number" step="1" min="0" required value={investmentAmount} onChange={(e) => setInvestmentAmount(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Masa Manfaat (tahun)</label>
            <input
              type="number" step="1" min="1" required value={usefulLifeYears} onChange={(e) => setUsefulLifeYears(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Sewa Lahan/bulan (Rp)</label>
            <input
              type="number" step="1" min="0" required value={landRentPerMonth} onChange={(e) => setLandRentPerMonth(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Mulai Operasional</label>
          <input
            type="date" value={operationalStartDate} onChange={(e) => setOperationalStartDate(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={() => setEditing(false)}
            className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50">
            Batal
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
            Simpan
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-5 space-y-2.5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 text-sm md:text-base">Investasi</h2>
        <button onClick={() => setEditing(true)} className="text-xs text-emerald-600 hover:underline font-medium">
          Edit
        </button>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Investasi Modal</span>
        <span className="font-medium text-gray-900">{formatRupiah(settings.investmentAmount)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Depresiasi/tahun</span>
        <span className="font-medium text-gray-900">{formatRupiah(computed.depresiasiPerTahun)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Depresiasi/bulan</span>
        <span className="font-medium text-gray-900">{formatRupiah(computed.depresiasiPerBulan)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Sewa Lahan/bulan</span>
        <span className="font-medium text-gray-900">{formatRupiah(settings.landRentPerMonth)}</span>
      </div>
      <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
        <span className="text-gray-600 font-medium">Sisa Penyusutan</span>
        <span className="font-bold text-gray-900">{formatRupiah(computed.sisaPenyusutan)}</span>
      </div>
      {!settings.operationalStartDate && (
        <p className="text-xs text-amber-600 pt-1">⚠ Tanggal Mulai Operasional belum diatur — depresiasi berjalan belum terhitung.</p>
      )}
    </div>
  )
}
