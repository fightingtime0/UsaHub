'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatRupiah } from '@/lib/utils'

type Paket = {
  id: string
  name: string
  description: string | null
  price: number
  isAvailable: boolean
}

const inputCls =
  'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500'

export function PaketClient({ paket, canEdit }: { paket: Paket[]; canEdit: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')

  async function tambah(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/kopitelo/paket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: description || null, price: parseFloat(price) }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error ?? 'Gagal menambah paket')
        return
      }
      setName(''); setDescription(''); setPrice('')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setLoading(true)
    try {
      const res = await fetch('/api/kopitelo/paket/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error ?? 'Gagal memperbarui paket')
        return
      }
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  function ubahHarga(p: Paket) {
    const input = prompt('Harga per orang untuk "' + p.name + '" (Rp):', String(p.price))
    if (!input) return
    const nilai = parseFloat(input)
    if (isNaN(nilai) || nilai < 0) {
      alert('Harga tidak valid')
      return
    }
    patch(p.id, { price: nilai })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/kopitelo" className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Kembali">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 truncate">Paket Makan</h1>
          <p className="text-xs md:text-sm text-gray-500">
            Harga dihitung per orang. Paket aktif inilah yang muncul di form reservasi publik.
          </p>
        </div>
      </div>

      {canEdit && (
        <form onSubmit={tambah} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-5 space-y-3">
          <h2 className="font-semibold text-gray-900 text-sm md:text-base">Paket Baru</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nama Paket *</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
                placeholder="mis. Paket P" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Harga per Orang *</label>
              <input type="number" min="0" step="1" required value={price} onChange={(e) => setPrice(e.target.value)}
                placeholder="mis. 32000" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Isi Paket</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="mis. nasi, ayam goreng, sayur, teh" className={inputCls} />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={loading}
              className="px-5 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors disabled:opacity-50">
              {loading ? 'Menyimpan...' : 'Tambah Paket'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        {paket.length === 0 && (
          <p className="p-8 text-center text-sm text-gray-400">Belum ada paket</p>
        )}
        {paket.map((p) => (
          <div key={p.id} className="p-4 md:p-5 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-gray-900">{p.name}</p>
                {!p.isAvailable && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">
                    Nonaktif
                  </span>
                )}
              </div>
              {p.description && <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>}
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <p className="text-sm font-bold text-gray-900">
                {formatRupiah(p.price)}
                <span className="text-xs font-normal text-gray-400"> /org</span>
              </p>
              {canEdit && (
                <>
                  <button onClick={() => ubahHarga(p)} disabled={loading}
                    className="px-3 py-1.5 text-xs font-semibold border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
                    Ubah Harga
                  </button>
                  <button onClick={() => patch(p.id, { isAvailable: !p.isAvailable })} disabled={loading}
                    className={
                      'px-3 py-1.5 text-xs font-semibold border rounded-lg transition-colors disabled:opacity-50 ' +
                      (p.isAvailable
                        ? 'border-red-200 text-red-600 hover:bg-red-50'
                        : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50')
                    }>
                    {p.isAvailable ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
