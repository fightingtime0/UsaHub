'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatRupiah, formatDateTime } from '@/lib/utils'
import { waLink, reservasiWaText } from '@/lib/whatsapp'

type Paket = { id: string; name: string; price: number }

type Reservasi = {
  id: string
  orderCode: string
  travelName: string | null
  customerName: string
  customerPhone: string | null
  busPo: string | null
  source: string
  eventDate: string
  pax: number
  menuType: string
  customMenu: string | null
  pricePerPax: number
  totalPrice: number
  paidAmount: number
  status: string
  note: string | null
}

const STATUS_BADGE: Record<string, string> = {
  PENDING:   'bg-amber-100 text-amber-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
}
const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Menunggu', CONFIRMED: 'Terkonfirmasi', COMPLETED: 'Selesai', CANCELLED: 'Batal',
}

const inputCls =
  'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500'

export function ReservasiClient({
  unitName,
  paket,
  reservasi,
}: {
  unitName: string
  paket: Paket[]
  reservasi: Reservasi[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<string>('AKTIF')

  const [travelName, setTravelName] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [busPo, setBusPo] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [menuItemId, setMenuItemId] = useState(paket[0]?.id ?? '')
  const [pax, setPax] = useState('')
  const [customMenu, setCustomMenu] = useState('')
  const [dpAmount, setDpAmount] = useState('')

  const paketDipilih = paket.find((p) => p.id === menuItemId)
  const total = (parseInt(pax) || 0) * (paketDipilih?.price ?? 0)

  const terlihat = reservasi.filter((r) => {
    if (filter === 'SEMUA') return true
    if (filter === 'AKTIF') return r.status === 'PENDING' || r.status === 'CONFIRMED'
    return r.status === filter
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!paketDipilih) return
    setLoading(true)
    try {
      const res = await fetch('/api/kopitelo/reservasi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          travelName: travelName || null,
          customerName,
          busPo: busPo || null,
          customerPhone: customerPhone || null,
          eventDate,
          pax: parseInt(pax),
          menuType: paketDipilih.name,
          pricePerPax: paketDipilih.price,
          customMenu: customMenu || null,
          dpAmount: parseFloat(dpAmount) || 0,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error ?? 'Gagal menyimpan reservasi')
        return
      }
      setTravelName(''); setCustomerName(''); setBusPo(''); setCustomerPhone('')
      setEventDate(''); setPax(''); setCustomMenu(''); setDpAmount('')
      setShowForm(false)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setLoading(true)
    try {
      const res = await fetch('/api/kopitelo/reservasi/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error ?? 'Gagal memperbarui reservasi')
        return
      }
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  function updateStatus(id: string, status: string) {
    if (!confirm('Ubah status reservasi menjadi "' + (STATUS_LABEL[status] ?? status) + '"?')) return
    patch(id, { status })
  }

  function addPayment(id: string, sisa: number) {
    const input = prompt('Sisa tagihan ' + formatRupiah(sisa) + '.\nJumlah pembayaran (Rp):')
    if (!input) return
    const amount = parseFloat(input)
    if (isNaN(amount) || amount <= 0) {
      alert('Jumlah tidak valid')
      return
    }
    patch(id, { addPayment: amount })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/kopitelo" className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Kembali">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 truncate">Reservasi Rombongan</h1>
            <p className="text-xs md:text-sm text-gray-500">Dari form publik maupun dicatat operator</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          disabled={paket.length === 0}
          className="flex-shrink-0 px-3 py-2 text-xs md:text-sm font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:bg-amber-300 transition-colors whitespace-nowrap"
        >
          {showForm ? 'Tutup Form' : '+ Reservasi Baru'}
        </button>
      </div>

      {paket.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          Belum ada paket makan aktif. Buat paket dulu di{' '}
          <Link href="/kopitelo/paket" className="font-semibold underline">
            Kelola Paket
          </Link>{' '}
          — form reservasi publik juga kosong sampai ada paket.
        </div>
      )}

      {showForm && paket.length > 0 && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-5 space-y-3">
          <h2 className="font-semibold text-gray-900 text-sm md:text-base">Reservasi Baru</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nama Travel</label>
              <input type="text" value={travelName} onChange={(e) => setTravelName(e.target.value)}
                placeholder="mis. LetsGo Tour Jogja" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nama Rombongan *</label>
              <input type="text" required value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                placeholder="mis. Aida" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">PO Bus</label>
              <input type="text" value={busPo} onChange={(e) => setBusPo(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tanggal & Jam *</label>
              <input type="datetime-local" required value={eventDate} onChange={(e) => setEventDate(e.target.value)}
                className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Menu Makan *</label>
              <select required value={menuItemId} onChange={(e) => setMenuItemId(e.target.value)} className={inputCls}>
                {paket.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatRupiah(p.price)}/org
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Jumlah Peserta *</label>
              <input type="number" min="1" required value={pax} onChange={(e) => setPax(e.target.value)}
                placeholder="mis. 32" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">No. WhatsApp Pemesan</label>
              <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="mis. 0812xxxxxxx" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">DP (Rp)</label>
              <input type="number" min="0" step="1" value={dpAmount} onChange={(e) => setDpAmount(e.target.value)}
                placeholder="0" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Permintaan Khusus</label>
              <input type="text" value={customMenu} onChange={(e) => setCustomMenu(e.target.value)}
                placeholder="mis. 3 porsi tanpa pedas" className={inputCls} />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 pt-3">
            <div>
              <p className="text-xs text-gray-500">
                Total ({pax || 0} orang × {formatRupiah(paketDipilih?.price ?? 0)})
              </p>
              <p className="text-lg font-bold text-gray-900">{formatRupiah(total)}</p>
            </div>
            <button type="submit" disabled={loading}
              className="px-5 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors disabled:opacity-50">
              {loading ? 'Menyimpan...' : 'Simpan Reservasi'}
            </button>
          </div>
        </form>
      )}

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'AKTIF', label: 'Aktif' },
          { key: 'PENDING', label: 'Menunggu' },
          { key: 'CONFIRMED', label: 'Terkonfirmasi' },
          { key: 'COMPLETED', label: 'Selesai' },
          { key: 'SEMUA', label: 'Semua' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={
              'px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ' +
              (filter === f.key
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50')
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Daftar */}
      <div className="space-y-3">
        {terlihat.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center text-gray-400 text-sm">
            Tidak ada reservasi pada filter ini
          </div>
        )}
        {terlihat.map((r) => {
          const sisa = r.totalPrice - r.paidAmount
          // Balas ke pemesan lewat WhatsApp — nomor pemesan, bukan nomor operator.
          const balasWa = r.customerPhone
            ? waLink(
                r.customerPhone,
                'Halo ' + r.customerName + ', reservasi ' + r.orderCode + ' di ' + unitName + ' sudah kami terima.\n\n' +
                  reservasiWaText(r, unitName)
              )
            : null

          return (
            <div key={r.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-gray-900">{r.customerName}</p>
                    <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + STATUS_BADGE[r.status]}>
                      {STATUS_LABEL[r.status]}
                    </span>
                    {r.source === 'WEB' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-purple-100 text-purple-700">
                        WEB
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{r.orderCode}</span>
                  </div>
                  {r.travelName && <p className="text-sm text-gray-600 mt-1">Travel: {r.travelName}</p>}
                  <p className="text-sm text-gray-600 mt-0.5">
                    {formatDateTime(r.eventDate)} · <span className="font-semibold">{r.pax} orang</span> · {r.menuType}
                  </p>
                  {r.busPo && <p className="text-xs text-gray-500 mt-0.5">PO Bus: {r.busPo}</p>}
                  {r.customMenu && (
                    <p className="text-xs text-gray-500 mt-1 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1 inline-block">
                      Permintaan: {r.customMenu}
                    </p>
                  )}
                  {r.customerPhone && <p className="text-xs text-gray-400 mt-1">☎ {r.customerPhone}</p>}
                  {r.note && <p className="text-xs text-gray-400 mt-0.5">{r.note}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-500">{formatRupiah(r.pricePerPax)} / org</p>
                  <p className="text-lg font-bold text-gray-900">{formatRupiah(r.totalPrice)}</p>
                  <p className={'text-xs font-semibold ' + (sisa <= 0 ? 'text-emerald-600' : 'text-red-600')}>
                    {sisa <= 0 ? 'Lunas' : 'Sisa ' + formatRupiah(sisa)}
                  </p>
                  {r.paidAmount > 0 && sisa > 0 && (
                    <p className="text-xs text-gray-400">Dibayar {formatRupiah(r.paidAmount)}</p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-50">
                {balasWa && (
                  <a
                    href={balasWa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-xs font-semibold border border-[#25D366] text-[#128C7E] rounded-lg hover:bg-emerald-50 transition-colors"
                  >
                    Balas via WhatsApp
                  </a>
                )}
                {r.status !== 'CANCELLED' && r.status !== 'COMPLETED' && (
                  <>
                    {r.status === 'PENDING' && (
                      <button onClick={() => updateStatus(r.id, 'CONFIRMED')} disabled={loading}
                        className="px-3 py-1.5 text-xs font-semibold border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50">
                        Konfirmasi
                      </button>
                    )}
                    {sisa > 0 && (
                      <button onClick={() => addPayment(r.id, sisa)} disabled={loading}
                        className="px-3 py-1.5 text-xs font-semibold border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-50">
                        + Pembayaran
                      </button>
                    )}
                    <button onClick={() => updateStatus(r.id, 'COMPLETED')} disabled={loading}
                      className="px-3 py-1.5 text-xs font-semibold border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
                      Tandai Selesai
                    </button>
                    <button onClick={() => updateStatus(r.id, 'CANCELLED')} disabled={loading}
                      className="px-3 py-1.5 text-xs font-semibold border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50">
                      Batalkan
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
