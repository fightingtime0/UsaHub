'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Unit = { id: string; name: string; type: string; location: string | null }

const UNIT_TYPE_LABEL: Record<string, string> = {
  RETAIL: 'Toko',
  HOMESTAY: 'Homestay',
  RESTAURANT: 'Restoran',
  LODGING: 'Penginapan',
  PERTASHOP: 'Pertashop',
  KOPI_TELO: 'Kopi Telo',
}

function SiteNameCard({ initialSiteName }: { initialSiteName: string }) {
  const router = useRouter()
  const [siteName, setSiteName] = useState(initialSiteName)
  const [input, setInput] = useState(initialSiteName)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)
    if (!input.trim()) return setError('Nama aplikasi tidak boleh kosong')

    setLoading(true)
    try {
      const res = await fetch('/api/settings/site', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteName: input.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Gagal menyimpan')
        return
      }
      setSiteName(data.siteName)
      setSuccess(true)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-5">
      <h2 className="font-semibold text-gray-900 text-sm md:text-base mb-1">Nama Bisnis</h2>
      <p className="text-xs text-gray-500 mb-4">Judul tab browser dan nama yang tampil di sidebar — khusus bisnis Anda, tidak memengaruhi tenant lain. Saat ini: <span className="font-medium text-gray-700">{siteName}</span></p>
      <form onSubmit={handleSave} className="flex gap-2 max-w-md">
        <input
          value={input} onChange={(e) => setInput(e.target.value)}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          type="submit" disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors flex-shrink-0"
        >
          {loading ? 'Menyimpan...' : 'Simpan'}
        </button>
      </form>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      {success && <p className="text-xs text-emerald-600 mt-2">Tersimpan.</p>}
    </div>
  )
}

function UnitRow({ unit }: { unit: Unit }) {
  const router = useRouter()
  const [location, setLocation] = useState(unit.location ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const dirty = location.trim() !== (unit.location ?? '')

  async function handleSave() {
    if (!dirty) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`/api/settings/units/${unit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: location.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Gagal menyimpan')
        return
      }
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-4 md:px-5 py-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600 flex-shrink-0">
          {UNIT_TYPE_LABEL[unit.type] ?? unit.type}
        </span>
        <p className="flex-1 text-sm font-medium text-gray-800 px-1 py-2" title="Nama unit hanya bisa diubah oleh Superadmin">
          {unit.name}
        </p>
        <button
          onClick={handleSave} disabled={!dirty || loading}
          className="text-xs text-indigo-600 hover:underline font-medium disabled:text-gray-300 disabled:no-underline flex-shrink-0"
        >
          {loading ? 'Menyimpan...' : 'Simpan'}
        </button>
      </div>
      <input
        value={location} onChange={(e) => setLocation(e.target.value)}
        placeholder="Alamat / lokasi (mis. Jl. Raya Jetis KM 3)"
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

export function PengaturanClient({ siteName, units }: { siteName: string; units: Unit[] }) {
  return (
    <>
      <SiteNameCard initialSiteName={siteName} />

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-4 md:px-5 py-3 md:py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-sm md:text-base">Unit Bisnis</h2>
          <p className="text-xs text-gray-500 mt-0.5">Alamat/lokasi unit. Nama unit hanya bisa diubah oleh Superadmin.</p>
        </div>
        <div className="divide-y divide-gray-50">
          {units.length === 0 && (
            <p className="px-4 md:px-5 py-4 text-sm text-gray-400 text-center">Belum ada unit bisnis</p>
          )}
          {units.map((u) => <UnitRow key={u.id} unit={u} />)}
        </div>
      </div>
    </>
  )
}
