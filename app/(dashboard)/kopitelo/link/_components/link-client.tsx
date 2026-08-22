'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'
import { toWaNumber } from '@/lib/whatsapp'

export function LinkClient({
  unitId,
  unitName,
  operatorPhone,
}: {
  unitId: string
  unitName: string
  operatorPhone: string | null
}) {
  const [qr, setQr] = useState('')
  const [url, setUrl] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const u = window.location.origin + '/reservasi/' + unitId
    setUrl(u)
    QRCode.toDataURL(u, { width: 500, margin: 2 }).then(setQr)
  }, [unitId])

  // Nomor operator dipakai tombol WhatsApp di halaman publik. Kalau kosong atau
  // formatnya tidak terbaca, pemesan hanya dapat kode reservasi tanpa tombol.
  const waSiap = operatorPhone ? toWaNumber(operatorPhone) : null

  async function salin() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/kopitelo" className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Kembali">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 truncate">Link Reservasi Publik</h1>
            <p className="text-xs md:text-sm text-gray-500">
              Bagikan ke biro travel — mereka mengisi form tanpa perlu login
            </p>
          </div>
        </div>
        <button
          onClick={() => window.print()}
          className="flex-shrink-0 px-4 py-2 text-sm font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
        >
          🖨 Cetak
        </button>
      </div>

      {!waSiap && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 print:hidden">
          {operatorPhone
            ? 'Nomor unit "' + operatorPhone + '" tidak terbaca sebagai nomor WhatsApp Indonesia.'
            : 'Nomor telepon unit belum diisi.'}{' '}
          Tanpa itu, pemesan tetap bisa mengirim reservasi tapi tidak mendapat tombol konfirmasi ke WhatsApp operator.
          Isi lewat <span className="font-semibold">Pengaturan → nomor unit</span>.
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col items-center text-center max-w-md mx-auto print:border-2 print:border-dashed">
        <p className="font-bold text-gray-900 text-lg">{unitName}</p>
        <p className="text-xs text-gray-500 mb-3">Scan untuk reservasi rombongan</p>
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="QR reservasi" className="w-full max-w-[240px]" />
        ) : (
          <div className="w-[240px] h-[240px] bg-gray-100 rounded-lg animate-pulse" />
        )}
        <p className="text-[11px] text-gray-400 mt-3 break-all">{url || '...'}</p>

        <button
          onClick={salin}
          className="mt-4 px-4 py-2 text-xs font-semibold border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors print:hidden"
        >
          {copied ? '✓ Tersalin' : 'Salin Link'}
        </button>
      </div>
    </div>
  )
}
