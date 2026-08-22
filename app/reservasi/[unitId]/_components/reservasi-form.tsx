'use client'

import { useState } from 'react'
import { formatRupiah } from '@/lib/utils'
import { waLink, reservasiWaText } from '@/lib/whatsapp'

type Paket = { id: string; name: string; description: string | null; price: number }

type Hasil = {
  orderCode: string
  menuType: string
  pricePerPax: number
  totalPrice: number
  eventDate: string
  travelName: string | null
  customerName: string
  busPo: string | null
  pax: number
  customMenu: string | null
}

const inputCls =
  'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500'

function Baris({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 py-1.5 border-b border-amber-100 last:border-0">
      <span className="text-xs text-gray-500 w-36 flex-shrink-0 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium text-gray-900 min-w-0 break-words">{value}</span>
    </div>
  )
}

export function ReservasiForm({
  unitId,
  unitName,
  unitLocation,
  operatorPhone,
  paket,
}: {
  unitId: string
  unitName: string
  unitLocation: string | null
  operatorPhone: string | null
  paket: Paket[]
}) {
  const [travelName, setTravelName] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [busPo, setBusPo] = useState('')
  const [tanggal, setTanggal] = useState('')
  const [jam, setJam] = useState('')
  const [menuItemId, setMenuItemId] = useState(paket[0]?.id ?? '')
  const [pax, setPax] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customMenu, setCustomMenu] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasil, setHasil] = useState<Hasil | null>(null)

  const paketDipilih = paket.find((p) => p.id === menuItemId)
  const estimasi = (parseInt(pax) || 0) * (paketDipilih?.price ?? 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    // Digabung di client karena form memisah TANGGAL dan JAM (mengikuti form cetak).
    const eventDate = tanggal + 'T' + jam

    setLoading(true)
    try {
      const res = await fetch('/api/public/reservasi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId,
          travelName: travelName || null,
          customerName,
          busPo: busPo || null,
          eventDate,
          menuItemId,
          pax: parseInt(pax),
          customerPhone,
          customMenu: customMenu || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Gagal mengirim reservasi')
        return
      }
      setHasil({
        orderCode: data.orderCode,
        menuType: data.menuType,
        pricePerPax: data.pricePerPax,
        totalPrice: data.totalPrice,
        eventDate,
        travelName: travelName || null,
        customerName,
        busPo: busPo || null,
        pax: parseInt(pax),
        customMenu: customMenu || null,
      })
    } catch {
      setError('Jaringan bermasalah. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  // ── Layar hasil: info reservasi + konfirmasi ke operator lewat WhatsApp ──
  if (hasil) {
    const link = operatorPhone ? waLink(operatorPhone, reservasiWaText(hasil, unitName)) : null
    const d = new Date(hasil.eventDate)

    return (
      <div className="min-h-screen bg-amber-50 p-4 md:p-8">
        <div className="max-w-lg mx-auto space-y-4">
          <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-5 md:p-6">
            <div className="text-center mb-5">
              <div className="w-14 h-14 rounded-full bg-emerald-100 mx-auto flex items-center justify-center mb-3">
                <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-lg font-bold text-gray-900">Reservasi Tercatat</h1>
              <p className="text-xs text-gray-500 mt-1">
                Kode reservasi <span className="font-bold text-gray-700">{hasil.orderCode}</span>
              </p>
            </div>

            <div className="bg-amber-50/60 rounded-xl p-4">
              <p className="text-xs font-bold text-amber-800 uppercase tracking-widest mb-2">
                Form Reservasi {unitName}
              </p>
              <Baris label="Nama Travel" value={hasil.travelName ?? '-'} />
              <Baris label="Nama Rombongan" value={hasil.customerName} />
              <Baris label="PO Bus" value={hasil.busPo ?? '-'} />
              <Baris
                label="Tanggal"
                value={d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
              />
              <Baris label="Jam" value={d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} />
              <Baris label="Menu Makan" value={hasil.menuType + ' (' + formatRupiah(hasil.pricePerPax) + '/org)'} />
              <Baris label="Jumlah Peserta" value={hasil.pax + ' orang'} />
              <Baris label="Estimasi Total" value={formatRupiah(hasil.totalPrice)} />
              {hasil.customMenu && <Baris label="Catatan" value={hasil.customMenu} />}
            </div>

            <p className="text-xs text-gray-500 mt-4 leading-relaxed">
              Reservasi ini masih <span className="font-semibold">menunggu konfirmasi</span> operator. Lanjutkan ke
              WhatsApp agar operator segera memproses dan memastikan ketersediaan tempat.
            </p>
          </div>

          {link ? (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#1da851] text-white font-semibold py-3.5 rounded-xl transition-colors shadow-sm"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3.1.8.8-3-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-5.8c-.3-.2-1.7-.9-2-1-.3-.1-.5-.2-.7.1s-.7 1-.9 1.2c-.2.2-.3.2-.6.1a8 8 0 0 1-4-3.5c-.3-.5.3-.5.8-1.5.1-.2 0-.4 0-.5l-.9-2.1c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.2 3.4 5.3 4.7 2 .8 2.7.9 3.7.8.6-.1 1.7-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.2-.6-.4z" />
              </svg>
              Konfirmasi ke Operator via WhatsApp
            </a>
          ) : (
            <p className="text-center text-xs text-gray-500 bg-white rounded-xl border border-gray-200 p-4">
              Nomor WhatsApp operator belum diatur. Simpan kode reservasi{' '}
              <span className="font-bold">{hasil.orderCode}</span> dan hubungi {unitName} langsung.
            </p>
          )}

          <button onClick={() => setHasil(null)} className="w-full text-xs text-gray-500 hover:text-gray-700 py-2">
            Buat reservasi lain
          </button>
        </div>
      </div>
    )
  }

  // ── Form ──
  return (
    <div className="min-h-screen bg-amber-50 p-4 md:p-8">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-5">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Form Reservasi {unitName}</h1>
          {unitLocation && <p className="text-xs text-gray-500 mt-1">{unitLocation}</p>}
          <p className="text-xs text-gray-500 mt-1">Khusus rombongan travel — isi data di bawah ini</p>
        </div>

        {paket.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
            <p className="text-sm text-gray-500">
              Belum ada paket menu yang dibuka. Silakan hubungi {unitName} langsung.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl border border-amber-200 shadow-sm p-5 md:p-6 space-y-3.5"
          >
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Nama Travel</label>
              <input
                type="text"
                value={travelName}
                onChange={(e) => setTravelName(e.target.value)}
                placeholder="mis. LetsGo Tour Jogja"
                className={inputCls}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Nama Rombongan *</label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="mis. Aida"
                className={inputCls}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">PO Bus</label>
              <input
                type="text"
                value={busPo}
                onChange={(e) => setBusPo(e.target.value)}
                placeholder="mis. PO Haryanto"
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Tanggal *</label>
                <input
                  type="date"
                  required
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Jam *</label>
                <input
                  type="time"
                  required
                  value={jam}
                  onChange={(e) => setJam(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Menu Makan *</label>
              <select required value={menuItemId} onChange={(e) => setMenuItemId(e.target.value)} className={inputCls}>
                {paket.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatRupiah(p.price)}/org
                  </option>
                ))}
              </select>
              {paketDipilih?.description && <p className="text-xs text-gray-500 mt-1">{paketDipilih.description}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Jumlah Peserta *</label>
              <input
                type="number"
                min="1"
                required
                value={pax}
                onChange={(e) => setPax(e.target.value)}
                placeholder="mis. 32"
                className={inputCls}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">No. WhatsApp Pemesan *</label>
              <input
                type="tel"
                required
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="mis. 0812xxxxxxx"
                className={inputCls}
              />
              <p className="text-xs text-gray-400 mt-1">Dipakai operator untuk mengonfirmasi reservasi Anda.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Permintaan Khusus</label>
              <textarea
                value={customMenu}
                onChange={(e) => setCustomMenu(e.target.value)}
                rows={2}
                placeholder="mis. 3 porsi tanpa pedas, 2 vegetarian"
                className={inputCls}
              />
            </div>

            {estimasi > 0 && (
              <div className="flex items-center justify-between bg-amber-50 rounded-xl px-4 py-3">
                <div>
                  <p className="text-xs text-gray-500">
                    Estimasi ({pax || 0} orang × {formatRupiah(paketDipilih?.price ?? 0)})
                  </p>
                  <p className="text-lg font-bold text-gray-900">{formatRupiah(estimasi)}</p>
                </div>
              </div>
            )}

            {error && <p className="text-xs text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white font-semibold py-3.5 rounded-xl transition-colors"
            >
              {loading ? 'Mengirim...' : 'Kirim Reservasi'}
            </button>
            <p className="text-xs text-gray-400 text-center">
              Setelah dikirim, Anda akan diarahkan untuk konfirmasi ke operator via WhatsApp.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
