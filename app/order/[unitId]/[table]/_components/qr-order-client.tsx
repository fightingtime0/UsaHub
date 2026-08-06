'use client'

import { useEffect, useMemo, useState } from 'react'
import { formatRupiah } from '@/lib/utils'

type MenuItemLite = {
  id: string
  name: string
  description: string | null
  price: number
  imageUrl: string | null
  category: string
}

type CartItem = {
  menuItemId: string
  name: string
  price: number
  qty: number
  note: string
}

type ActiveOrder = {
  orderNumber: string
  status: string
  subtotal: number
  tax: number
  total: number
  items: { name: string; qty: number; price: number; subtotal: number; note: string | null; status: string }[]
}

const ITEM_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Menunggu', COOKING: 'Dimasak', SERVED: 'Disajikan',
}

export function QrOrderClient({
  unitId,
  restaurantName,
  tableNumber,
  menuItems,
}: {
  unitId: string
  restaurantName: string
  tableNumber: string
  menuItems: MenuItemLite[]
}) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [activeCategory, setActiveCategory] = useState<string>('Semua')
  const [search, setSearch] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [showCart, setShowCart] = useState(false)
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null)
  const [showOrder, setShowOrder] = useState(false)

  const categories = useMemo(
    () => ['Semua', ...Array.from(new Set(menuItems.map((m) => m.category)))],
    [menuItems]
  )

  const filtered = menuItems.filter((m) => {
    const catOk = activeCategory === 'Semua' || m.category === activeCategory
    const searchOk = !search || m.name.toLowerCase().includes(search.toLowerCase())
    return catOk && searchOk
  })

  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const cartCount = cart.reduce((s, i) => s + i.qty, 0)

  async function loadActiveOrder() {
    try {
      const res = await fetch(`/api/public/order?unitId=${encodeURIComponent(unitId)}&table=${encodeURIComponent(tableNumber)}`)
      if (res.ok) {
        const data = await res.json()
        setActiveOrder(data)
      }
    } catch {}
  }

  useEffect(() => {
    loadActiveOrder()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function addToCart(m: MenuItemLite) {
    setCart((prev) => {
      const existing = prev.find((i) => i.menuItemId === m.id)
      if (existing) {
        return prev.map((i) => (i.menuItemId === m.id ? { ...i, qty: i.qty + 1 } : i))
      }
      return [...prev, { menuItemId: m.id, name: m.name, price: m.price, qty: 1, note: '' }]
    })
    setSent(false)
  }

  function changeQty(menuItemId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) => (i.menuItemId === menuItemId ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0)
    )
  }

  function setItemNote(menuItemId: string, note: string) {
    setCart((prev) => prev.map((i) => (i.menuItemId === menuItemId ? { ...i, note } : i)))
  }

  async function submitOrder() {
    if (cart.length === 0) return
    setSending(true)
    try {
      const res = await fetch('/api/public/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId,
          tableNumber,
          items: cart.map((i) => ({ menuItemId: i.menuItemId, qty: i.qty, note: i.note || null })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error ?? 'Gagal mengirim pesanan. Coba lagi atau hubungi pelayan.')
        return
      }
      setCart([])
      setShowCart(false)
      setSent(true)
      await loadActiveOrder()
      setShowOrder(true)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Header */}
      <header className="bg-orange-600 text-white px-4 py-4 sticky top-0 z-20 shadow-md">
        <div className="max-w-lg mx-auto">
          <p className="text-xs uppercase tracking-widest text-orange-200 font-semibold">{restaurantName}</p>
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-lg font-bold">Meja {tableNumber}</h1>
            <button
              onClick={() => { loadActiveOrder(); setShowOrder(true) }}
              className="text-xs bg-orange-500 hover:bg-orange-400 px-3 py-1.5 rounded-full font-semibold transition-colors"
            >
              Pesanan Saya
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        {/* Notifikasi terkirim */}
        {sent && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 text-sm">
            ✓ Pesanan terkirim ke kasir & dapur. <strong>Pembayaran dilakukan di kasir.</strong>
          </div>
        )}

        {/* Search */}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari menu..."
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
        />

        {/* Kategori */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setActiveCategory(c)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                activeCategory === c
                  ? 'bg-orange-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Daftar menu */}
        <div className="space-y-2.5">
          {filtered.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-8">Menu tidak ditemukan</p>
          )}
          {filtered.map((m) => {
            const inCart = cart.find((i) => i.menuItemId === m.id)
            return (
              <div key={m.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{m.name}</p>
                  {m.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{m.description}</p>}
                  <p className="text-sm font-bold text-orange-600 mt-1">{formatRupiah(m.price)}</p>
                </div>
                {inCart ? (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => changeQty(m.id, -1)}
                      className="w-8 h-8 rounded-full border border-orange-300 text-orange-600 font-bold flex items-center justify-center hover:bg-orange-50 active:scale-95 transition-all"
                    >
                      −
                    </button>
                    <span className="w-6 text-center font-bold text-gray-900 text-sm">{inCart.qty}</span>
                    <button
                      onClick={() => changeQty(m.id, 1)}
                      className="w-8 h-8 rounded-full bg-orange-600 text-white font-bold flex items-center justify-center hover:bg-orange-700 active:scale-95 transition-all"
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => addToCart(m)}
                    className="flex-shrink-0 px-4 py-2 bg-orange-600 text-white rounded-full text-xs font-bold hover:bg-orange-700 active:scale-95 transition-all"
                  >
                    Tambah
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </main>

      {/* Bar keranjang (bawah) */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-30 p-3 bg-gradient-to-t from-gray-50 via-gray-50">
          <button
            onClick={() => setShowCart(true)}
            className="max-w-lg mx-auto w-full bg-orange-600 text-white rounded-2xl px-5 py-3.5 flex items-center justify-between shadow-lg hover:bg-orange-700 transition-colors"
          >
            <span className="text-sm font-semibold">{cartCount} item</span>
            <span className="text-sm font-bold">Lihat Keranjang · {formatRupiah(cartTotal)}</span>
          </button>
        </div>
      )}

      {/* Sheet keranjang */}
      {showCart && (
        <div className="fixed inset-0 z-40 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCart(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-t-2xl max-h-[85vh] flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Keranjang — Meja {tableNumber}</h2>
              <button onClick={() => setShowCart(false)} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Tutup">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
              {cart.map((i) => (
                <div key={i.menuItemId} className="border border-gray-100 rounded-xl p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{i.name}</p>
                      <p className="text-xs text-gray-400">{formatRupiah(i.price)} × {i.qty}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => changeQty(i.menuItemId, -1)}
                        className="w-7 h-7 rounded-full border border-gray-300 text-gray-600 font-bold flex items-center justify-center hover:bg-gray-50"
                      >
                        −
                      </button>
                      <span className="w-5 text-center font-bold text-sm">{i.qty}</span>
                      <button
                        onClick={() => changeQty(i.menuItemId, 1)}
                        className="w-7 h-7 rounded-full bg-orange-600 text-white font-bold flex items-center justify-center hover:bg-orange-700"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={i.note}
                    onChange={(e) => setItemNote(i.menuItemId, e.target.value)}
                    placeholder="Catatan (mis. tidak pedas)"
                    maxLength={200}
                    className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              ))}
            </div>

            <div className="px-5 py-4 border-t border-gray-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Total (belum termasuk pajak)</span>
                <span className="text-lg font-bold text-gray-900">{formatRupiah(cartTotal)}</span>
              </div>
              <button
                onClick={submitOrder}
                disabled={sending || cart.length === 0}
                className="w-full bg-orange-600 text-white rounded-xl py-3.5 font-bold hover:bg-orange-700 transition-colors disabled:opacity-50"
              >
                {sending ? 'Mengirim...' : 'Kirim Pesanan'}
              </button>
              <p className="text-xs text-gray-400 text-center">
                Pesanan dikirim ke kasir & dapur. Pembayaran dilakukan di kasir.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sheet pesanan saya */}
      {showOrder && (
        <div className="fixed inset-0 z-40 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowOrder(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-t-2xl max-h-[85vh] flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Pesanan Meja {tableNumber}</h2>
              <button onClick={() => setShowOrder(false)} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Tutup">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3">
              {!activeOrder && (
                <p className="text-center text-gray-400 text-sm py-8">Belum ada pesanan untuk meja ini</p>
              )}
              {activeOrder && (
                <div className="space-y-2">
                  {activeOrder.items.map((i, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 border-b border-gray-50 pb-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {i.name} <span className="text-gray-400">×{i.qty}</span>
                        </p>
                        {i.note && <p className="text-xs text-gray-400">{i.note}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-gray-800">{formatRupiah(i.subtotal)}</p>
                        <span className="text-xs text-orange-600">{ITEM_STATUS_LABEL[i.status] ?? i.status}</span>
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 space-y-1">
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Subtotal</span><span>{formatRupiah(activeOrder.subtotal)}</span>
                    </div>
                    {activeOrder.tax > 0 && (
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>Pajak</span><span>{formatRupiah(activeOrder.tax)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-gray-900">
                      <span>Total</span><span>{formatRupiah(activeOrder.total)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 text-center pt-3 pb-2">
                    💳 Silakan lakukan pembayaran di kasir
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
