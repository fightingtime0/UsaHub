'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatRupiah, formatDate } from '@/lib/utils'

type ReconLite = {
  id: string
  date: string
  reportedSales: number
  expenseAmount: number
  depositAmount: number
  difference: number
  note: string | null
}

type ExpenseLite = {
  id: string
  date: string
  shift: string | null
  amount: number
  description: string
}

function todayStr() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function RekonsiliasiClient({ recons }: { recons: ReconLite[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const [date, setDate] = useState(todayStr())
  const [deposit, setDeposit] = useState('')
  const [note, setNote] = useState('')

  // Preview total laporan jualan untuk tanggal terpilih
  const [reported, setReported] = useState<{ reportedSales: number; totalLiters: number; saleCount: number; totalExpenses: number; netExpected: number } | null>(null)

  // ── Biaya pengeluaran (mengurangi setoran) untuk tanggal terpilih ──
  const [expenses, setExpenses] = useState<ExpenseLite[]>([])
  const [expLoading, setExpLoading] = useState(false)
  const [expShift, setExpShift] = useState('')
  const [expAmount, setExpAmount] = useState('')
  const [expDesc, setExpDesc] = useState('')

  function loadReported(cancelledRef?: { current: boolean }) {
    fetch(`/api/pertashop/rekonsiliasi?date=${date}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && !cancelledRef?.current) setReported(d)
      })
      .catch(() => {})
  }

  function loadExpenses(cancelledRef?: { current: boolean }) {
    fetch(`/api/pertashop/pengeluaran?date=${date}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        if (!cancelledRef?.current) setExpenses(Array.isArray(d) ? d : [])
      })
      .catch(() => {})
  }

  useEffect(() => {
    const cancelledRef = { current: false }
    setReported(null)
    setExpenses([])
    loadReported(cancelledRef)
    loadExpenses(cancelledRef)
    return () => {
      cancelledRef.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  const netExpected = reported !== null ? reported.netExpected : null
  const diff = netExpected !== null && deposit !== '' ? parseFloat(deposit) - netExpected : null

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault()
    setExpLoading(true)
    try {
      const res = await fetch('/api/pertashop/pengeluaran', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, shift: expShift || null, amount: parseFloat(expAmount), description: expDesc }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error ?? 'Gagal mencatat pengeluaran')
        return
      }
      setExpAmount('')
      setExpDesc('')
      loadExpenses()
      loadReported()
    } finally {
      setExpLoading(false)
    }
  }

  async function handleDeleteExpense(id: string) {
    if (!confirm('Hapus biaya pengeluaran ini?')) return
    setExpLoading(true)
    try {
      const res = await fetch(`/api/pertashop/pengeluaran?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error ?? 'Gagal menghapus pengeluaran')
        return
      }
      loadExpenses()
      loadReported()
    } finally {
      setExpLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/pertashop/rekonsiliasi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, depositAmount: parseFloat(deposit), note: note || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error ?? 'Gagal mencatat rekonsiliasi')
        return
      }
      setDeposit('')
      setNote('')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

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
        {/* Form + biaya pengeluaran */}
        <div className="space-y-4 self-start">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-5 space-y-3">
            <h2 className="font-semibold text-gray-900 text-sm md:text-base">Biaya Pengeluaran</h2>
            <p className="text-xs text-gray-400 -mt-2">Biaya tunai yang diambil dari uang jualan shift ini (mis. beli oli, parkir) — mengurangi jumlah yang harus disetor.</p>

            <form onSubmit={handleAddExpense} className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text" list="exp-shift-options" value={expShift} onChange={(e) => setExpShift(e.target.value)}
                  placeholder="Shift (opsional)"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <datalist id="exp-shift-options">
                  <option value="Pagi" />
                  <option value="Siang" />
                  <option value="Malam" />
                </datalist>
                <input
                  type="number" step="1" min="1" required value={expAmount} onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="Jumlah (Rp)"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <input
                type="text" required value={expDesc} onChange={(e) => setExpDesc(e.target.value)}
                placeholder="Keterangan (mis. beli oli mesin)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit" disabled={expLoading}
                className="w-full border border-amber-500 text-amber-700 rounded-lg py-2 text-sm font-semibold hover:bg-amber-50 transition-colors disabled:opacity-50"
              >
                Tambah Pengeluaran
              </button>
            </form>

            <div className="divide-y divide-gray-50 -mx-4 md:-mx-5">
              {expenses.length === 0 && (
                <p className="px-4 md:px-5 py-3 text-xs text-gray-400 text-center">Belum ada pengeluaran tanggal ini</p>
              )}
              {expenses.map((ex) => (
                <div key={ex.id} className="px-4 md:px-5 py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 truncate">{ex.description}</p>
                    <p className="text-xs text-gray-400">{ex.shift ?? '—'}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm font-semibold text-red-600">−{formatRupiah(ex.amount)}</span>
                    <button onClick={() => handleDeleteExpense(ex.id)} className="text-xs text-gray-400 hover:text-red-500" aria-label="Hapus">
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {expenses.length > 0 && (
              <div className="flex justify-between text-sm font-semibold pt-1 border-t border-gray-100">
                <span className="text-gray-500 text-xs">Total pengeluaran</span>
                <span className="text-red-600">{formatRupiah(expenses.reduce((s, ex) => s + ex.amount, 0))}</span>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-5 space-y-3">
            <h2 className="font-semibold text-gray-900 text-sm md:text-base">Catat Rekonsiliasi</h2>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tanggal</label>
              <input
                type="date" required value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="rounded-lg bg-gray-50 p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 text-xs">Laporan jualan tanggal ini</span>
                <span className="font-semibold text-gray-900">
                  {reported === null ? '…' : formatRupiah(reported.reportedSales)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 text-xs">Biaya pengeluaran</span>
                <span className="font-semibold text-red-600">
                  {reported === null ? '…' : `−${formatRupiah(reported.totalExpenses)}`}
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-1">
                <span className="text-gray-600 text-xs font-medium">Setoran seharusnya</span>
                <span className="font-bold text-gray-900">
                  {reported === null ? '…' : formatRupiah(reported.netExpected)}
                </span>
              </div>
              {reported !== null && (
                <p className="text-xs text-gray-400">
                  {reported.saleCount} transaksi · {reported.totalLiters.toLocaleString('id-ID', { maximumFractionDigits: 2 })} liter
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Setoran Uang (Rp)</label>
              <input
                type="number" step="1" min="0" required value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
                placeholder="mis. 1250000"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {diff !== null && !isNaN(diff) && (
              <div
                className={`rounded-lg p-3 text-sm font-semibold ${
                  diff === 0
                    ? 'bg-emerald-50 text-emerald-700'
                    : diff > 0
                      ? 'bg-blue-50 text-blue-700'
                      : 'bg-red-50 text-red-700'
                }`}
              >
                {diff === 0
                  ? '✓ Setoran cocok dengan laporan'
                  : diff > 0
                    ? `Setoran lebih ${formatRupiah(diff)}`
                    : `Setoran kurang ${formatRupiah(Math.abs(diff))}`}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Catatan (opsional)</label>
              <input
                type="text" value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="mis. selisih uang kembalian"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading || reported === null}
              className="w-full bg-emerald-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Menyimpan...' : 'Simpan Rekonsiliasi'}
            </button>
          </form>
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
