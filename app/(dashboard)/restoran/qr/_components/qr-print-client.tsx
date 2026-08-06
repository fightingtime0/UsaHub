'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'

export function QrPrintClient({ tableNumbers, restaurantUnitId }: { tableNumbers: string[]; restaurantUnitId: string }) {
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({})
  const [origin, setOrigin] = useState('')

  useEffect(() => {
    const org = window.location.origin
    setOrigin(org)
    Promise.all(
      tableNumbers.map(async (t) => {
        const url = `${org}/order/${restaurantUnitId}/${encodeURIComponent(t)}`
        const dataUrl = await QRCode.toDataURL(url, { width: 400, margin: 2 })
        return [t, dataUrl] as const
      })
    ).then((entries) => setQrCodes(Object.fromEntries(entries)))
  }, [tableNumbers, restaurantUnitId])

  return (
    <div className="space-y-5">
      {/* Header — disembunyikan saat print */}
      <div className="flex items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/restoran" className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Kembali">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">QR Order Meja</h1>
            <p className="text-xs md:text-sm text-gray-500">
              Cetak & tempel di meja — pengunjung scan untuk memesan (bayar tetap di kasir)
            </p>
          </div>
        </div>
        <button
          onClick={() => window.print()}
          className="flex-shrink-0 px-4 py-2 text-sm font-semibold bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
        >
          🖨 Cetak Semua
        </button>
      </div>

      {/* Grid QR */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 print:grid-cols-2">
        {tableNumbers.map((t) => (
          <div
            key={t}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col items-center text-center print:break-inside-avoid print:border-2 print:border-dashed"
          >
            <p className="font-bold text-gray-900 text-lg">Meja {t}</p>
            <p className="text-xs text-gray-400 mb-2">Scan untuk memesan</p>
            {qrCodes[t] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrCodes[t]} alt={`QR Meja ${t}`} className="w-full max-w-[180px]" />
            ) : (
              <div className="w-[180px] h-[180px] bg-gray-100 rounded-lg animate-pulse" />
            )}
            <p className="text-[10px] text-gray-400 mt-2 break-all">
              {origin ? `${origin}/order/${restaurantUnitId}/${t}` : '...'}
            </p>
            <p className="text-xs text-gray-500 mt-1 font-medium">Pembayaran di kasir</p>
          </div>
        ))}
      </div>
    </div>
  )
}
