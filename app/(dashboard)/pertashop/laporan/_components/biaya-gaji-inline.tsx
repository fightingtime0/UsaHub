'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatRupiah } from '@/lib/utils'

// Biaya Gaji diisi manual tiap bulan (beda-beda karena lembur/bonus/potongan).
export function BiayaGajiInline({ month, initialAmount }: { month: string; initialAmount: number }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(initialAmount))
  const [loading, setLoading] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/pertashop/gaji', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, amount: parseFloat(value) || 0 }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error ?? 'Gagal menyimpan Biaya Gaji')
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
      <form onSubmit={handleSave} className="flex items-center justify-between gap-2 text-sm">
        <span className="text-gray-500 flex-shrink-0">Biaya Gaji</span>
        <div className="flex items-center gap-1.5">
          <input
            type="number" step="1" min="0" autoFocus value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-32 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button type="submit" disabled={loading} className="text-xs text-emerald-600 hover:underline font-medium disabled:opacity-50">
            Simpan
          </button>
          <button type="button" onClick={() => { setEditing(false); setValue(String(initialAmount)) }} className="text-xs text-gray-400 hover:underline">
            Batal
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">Biaya Gaji</span>
      <div className="flex items-center gap-2">
        <span className="font-medium text-red-600">−{formatRupiah(initialAmount)}</span>
        <button onClick={() => setEditing(true)} className="text-xs text-emerald-600 hover:underline font-medium">
          Edit
        </button>
      </div>
    </div>
  )
}
