'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatRupiah } from '@/lib/utils'

type Unit = { id: string; name: string; type: string }
type ItemType = 'TAMBAHAN' | 'POTONGAN'
type Item = { id?: string; type: ItemType; label: string; amount: number }
type Entry = {
  employeeId: string
  employeeName: string
  position: string | null
  baseSalary: number
  totalAdditions: number
  totalDeductions: number
  netTotal: number
  note: string | null
  items: Item[]
  saved: boolean
}
type Period = { id: string; status: 'DRAFT' | 'PAID'; paidAt: string | null } | null

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function GajiClient({
  units,
  role,
  initialUnitId,
  initialMonth,
}: {
  units: Unit[]
  role: string
  initialUnitId?: string
  initialMonth?: string
}) {
  const [unitId, setUnitId] = useState(initialUnitId ?? units[0]?.id ?? '')
  const [month, setMonth] = useState(initialMonth ?? currentMonth())
  const [period, setPeriod] = useState<Period>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<Entry | null>(null)
  const [statusLoading, setStatusLoading] = useState(false)

  useEffect(() => {
    if (!unitId || !month) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId, month])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/sdm/gaji?unitId=${unitId}&month=${month}`)
      if (!res.ok) return
      const data = await res.json()
      setPeriod(data.period)
      setEntries(data.entries)
    } finally {
      setLoading(false)
    }
  }

  const isPaid = period?.status === 'PAID'
  const totalNet = entries.reduce((s, e) => s + e.netTotal, 0)

  async function toggleStatus() {
    setStatusLoading(true)
    try {
      const res = await fetch('/api/sdm/gaji/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitId, month, status: isPaid ? 'DRAFT' : 'PAID' }),
      })
      if (res.ok) await load()
      else {
        const err = await res.json()
        alert(err.error ?? 'Gagal mengubah status')
      }
    } finally {
      setStatusLoading(false)
    }
  }

  async function saveEntry(entry: Entry) {
    const res = await fetch('/api/sdm/gaji', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unitId,
        month,
        employeeId: entry.employeeId,
        baseSalary: entry.baseSalary,
        note: entry.note,
        items: entry.items.map((i) => ({ type: i.type, label: i.label, amount: i.amount })),
      }),
    })
    if (!res.ok) {
      const err = await res.json()
      alert(err.error ?? 'Gagal menyimpan')
      return
    }
    setEditing(null)
    await load()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <select value={unitId} onChange={(e) => setUnitId(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
          {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />

        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          {isPaid ? 'Lunas' : 'Draft'}
        </span>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-gray-500">
            Total: <span className="font-semibold text-gray-900">{formatRupiah(totalNet)}</span>
          </span>
          {role === 'OWNER' && (
            <button onClick={toggleStatus} disabled={statusLoading || entries.length === 0}
              className={`text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${
                isPaid ? 'border border-gray-200 text-gray-600 hover:bg-gray-50' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}>
              {statusLoading ? '...' : isPaid ? 'Buka Kembali' : 'Tandai Lunas'}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-5 py-3 font-semibold">Karyawan</th>
                <th className="px-5 py-3 font-semibold text-right">Gaji Pokok</th>
                <th className="px-5 py-3 font-semibold text-right">Tambahan</th>
                <th className="px-5 py-3 font-semibold text-right">Potongan</th>
                <th className="px-5 py-3 font-semibold text-right">Total Bersih</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {!loading && entries.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400">Tidak ada karyawan aktif di unit ini</td></tr>
              )}
              {entries.map((e) => (
                <tr key={e.employeeId} className="hover:bg-gray-50">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-gray-900">{e.employeeName}</p>
                    {e.position && <p className="text-xs text-gray-400">{e.position}</p>}
                  </td>
                  <td className="px-5 py-3.5 text-right text-gray-700">{formatRupiah(e.baseSalary)}</td>
                  <td className="px-5 py-3.5 text-right text-emerald-600">
                    {e.totalAdditions > 0 ? `+${formatRupiah(e.totalAdditions)}` : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-right text-red-500">
                    {e.totalDeductions > 0 ? `−${formatRupiah(e.totalDeductions)}` : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold text-gray-900">{formatRupiah(e.netTotal)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button onClick={() => setEditing(e)} disabled={isPaid}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-40 disabled:cursor-not-allowed">
                      {isPaid ? 'Terkunci' : 'Kelola'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400">
        Belum ada karyawan? Tambahkan lewat <Link href="/sdm" className="text-indigo-600 hover:underline">halaman SDM</Link>, termasuk mengisi Gaji (dipakai sebagai default gaji pokok di sini).
      </p>

      {editing && (
        <EditModal
          entry={editing}
          onClose={() => setEditing(null)}
          onSave={saveEntry}
        />
      )}
    </div>
  )
}

function EditModal({ entry, onClose, onSave }: { entry: Entry; onClose: () => void; onSave: (e: Entry) => void }) {
  const [baseSalary, setBaseSalary] = useState(String(entry.baseSalary))
  const [note, setNote] = useState(entry.note ?? '')
  const [items, setItems] = useState<Item[]>(entry.items)
  const [saving, setSaving] = useState(false)

  const totalAdditions = items.filter((i) => i.type === 'TAMBAHAN').reduce((s, i) => s + (Number(i.amount) || 0), 0)
  const totalDeductions = items.filter((i) => i.type === 'POTONGAN').reduce((s, i) => s + (Number(i.amount) || 0), 0)
  const netTotal = (Number(baseSalary) || 0) + totalAdditions - totalDeductions

  function addItem(type: ItemType) {
    setItems((prev) => [...prev, { type, label: '', amount: 0 }])
  }
  function updateItem(idx: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }
  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    if (items.some((i) => !i.label.trim())) {
      alert('Semua baris tambahan/potongan harus punya keterangan')
      return
    }
    setSaving(true)
    try {
      await onSave({ ...entry, baseSalary: Number(baseSalary) || 0, note: note || null, items })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900">Gaji: {entry.employeeName}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Gaji Pokok (Rp)</label>
            <input type="number" min={0} value={baseSalary} onChange={(e) => setBaseSalary(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-gray-600">Tambahan &amp; Potongan</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => addItem('TAMBAHAN')}
                  className="text-xs text-emerald-600 hover:underline font-medium">+ Tambahan</button>
                <button type="button" onClick={() => addItem('POTONGAN')}
                  className="text-xs text-red-500 hover:underline font-medium">+ Potongan</button>
              </div>
            </div>

            {items.length === 0 && <p className="text-xs text-gray-400 py-2">Belum ada insentif/bonus/tunjangan/potongan</p>}

            {items.map((it, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1.5 rounded-lg font-medium flex-shrink-0 ${
                  it.type === 'TAMBAHAN' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                }`}>
                  {it.type === 'TAMBAHAN' ? '+' : '−'}
                </span>
                <input
                  type="text"
                  value={it.label}
                  onChange={(e) => updateItem(idx, { label: e.target.value })}
                  placeholder={it.type === 'TAMBAHAN' ? 'mis. Insentif Penjualan' : 'mis. Potongan Kasbon'}
                  className="flex-1 px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
                <input
                  type="number"
                  min={0}
                  value={it.amount}
                  onChange={(e) => updateItem(idx, { amount: Number(e.target.value) })}
                  className="w-28 px-2.5 py-1.5 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
                <button type="button" onClick={() => removeItem(idx)} className="text-gray-300 hover:text-red-500 flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Catatan (opsional)</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>

          <div className="bg-gray-50 rounded-lg px-4 py-3 space-y-1 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Tambahan</span><span className="text-emerald-600">+{formatRupiah(totalAdditions)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Potongan</span><span className="text-red-500">−{formatRupiah(totalDeductions)}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-200">
              <span>Total Bersih</span><span>{formatRupiah(netTotal)}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Batal
            </button>
            <button type="button" onClick={handleSave} disabled={saving}
              className="flex-1 px-4 py-2.5 text-sm bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors">
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
