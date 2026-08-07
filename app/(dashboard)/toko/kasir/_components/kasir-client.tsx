'use client'

import { useState, useRef } from 'react'
import { formatRupiah } from '@/lib/utils'
import { Receipt, printReceipt, type ReceiptData } from '@/components/receipt'
import { printViaRawBT, isAndroid } from '@/lib/escpos'

type Product = {
  id: string
  name: string
  sku: string | null
  unit: string
  sellPrice: number
  stock: number
  imageUrl: string | null
  category: { id: string; name: string } | null
}

type CartItem = {
  product: Product
  qty: number
  price: number  // bisa override
}

type Category = { id: string; name: string }

type Props = {
  products: Product[]
  categories: Category[]
  taxRate: number
  unitName: string
  unitLocation: string | null
}

function buildReceiptData(receipt: any, unitName: string, unitLocation: string | null): ReceiptData {
  return {
    storeName: unitName,
    storeLocation: unitLocation,
    invoiceNumber: receipt.invoiceNumber,
    dateTime: receipt.createdAt ?? new Date(),
    items: (receipt.items ?? []).map((item: any) => ({
      name: item.product.name,
      qty: Number(item.qty),
      price: Number(item.price),
      subtotal: Number(item.subtotal),
    })),
    subtotal: Number(receipt.subtotal),
    discount: Number(receipt.discount),
    tax: Number(receipt.tax),
    total: Number(receipt.total),
    paymentMethod: receipt.paymentMethod,
    paidAmount: Number(receipt.paidAmount),
    change: Number(receipt.change),
  }
}

const PAYMENT_METHODS = [
  { value: 'CASH',     label: 'Tunai' },
  { value: 'QRIS',     label: 'QRIS' },
  { value: 'TRANSFER', label: 'Transfer' },
  { value: 'CARD',     label: 'Kartu' },
]

export function KasirClient({ products, categories, taxRate, unitName, unitLocation }: Props) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [discount, setDiscount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [paidAmount, setPaidAmount] = useState('')
  const [processing, setProcessing] = useState(false)
  const [receipt, setReceipt] = useState<any>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const filteredProducts = products.filter((p) => {
    const matchSearch = !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku ?? '').toLowerCase().includes(search.toLowerCase())
    const matchCat = !filterCat || p.category?.id === filterCat
    return matchSearch && matchCat && p.stock > 0
  })

  // Barcode scanner USB bekerja sebagai keyboard: mengetik SKU lalu Enter.
  // Enter di kolom cari → SKU persis cocok (atau hasil filter tinggal satu) langsung masuk keranjang.
  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter' || !search.trim()) return
    e.preventDefault()

    const term = search.trim().toLowerCase()
    const bySku = products.find((p) => (p.sku ?? '').toLowerCase() === term && p.stock > 0)
    const target = bySku ?? (filteredProducts.length === 1 ? filteredProducts[0] : null)

    if (target) {
      addToCart(target)
      setSearch('')
    }
  }

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id)
      if (existing) {
        if (existing.qty >= product.stock) return prev // stok habis
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i
        )
      }
      return [...prev, { product, qty: 1, price: product.sellPrice }]
    })
  }

  function updateQty(productId: string, qty: number) {
    if (qty <= 0) {
      setCart((prev) => prev.filter((i) => i.product.id !== productId))
      return
    }
    const prod = products.find((p) => p.id === productId)
    if (prod && qty > prod.stock) return
    setCart((prev) => prev.map((i) => i.product.id === productId ? { ...i, qty } : i))
  }

  function updatePrice(productId: string, price: number) {
    setCart((prev) => prev.map((i) => i.product.id === productId ? { ...i, price } : i))
  }

  function removeItem(productId: string) {
    setCart((prev) => prev.filter((i) => i.product.id !== productId))
  }

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const taxAmount = Math.round(((subtotal - discount) * taxRate) / 100)
  const total = subtotal - discount + taxAmount
  const change = Number(paidAmount) - total

  const quickAmounts = [
    Math.ceil(total / 10000) * 10000,
    Math.ceil(total / 50000) * 50000,
    Math.ceil(total / 100000) * 100000,
  ].filter((v, i, arr) => arr.indexOf(v) === i && v >= total).slice(0, 3)

  async function handleCheckout() {
    if (cart.length === 0) return
    if (!paymentMethod) return
    if (paymentMethod === 'CASH' && Number(paidAmount) < total) {
      alert('Jumlah bayar kurang!')
      return
    }

    setProcessing(true)
    try {
      const res = await fetch('/api/toko/transaksi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map((i) => ({
            productId: i.product.id,
            qty: i.qty,
            price: i.price,
          })),
          paymentMethod,
          paidAmount: paymentMethod === 'CASH' ? Number(paidAmount) : total,
          discount,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        alert(err.error ?? 'Gagal memproses transaksi')
        return
      }

      const trx = await res.json()
      setReceipt(trx)
      setCart([])
      setPaidAmount('')
      setDiscount(0)
      setSearch('')
    } catch {
      alert('Terjadi kesalahan jaringan')
    } finally {
      setProcessing(false)
    }
  }

  function closeReceipt() {
    setReceipt(null)
    searchRef.current?.focus()
  }

  return (
    <div className="flex gap-5 h-[calc(100vh-120px)]">
      {/* Kiri: Produk Grid */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="mb-4 flex gap-3">
          <input
            ref={searchRef}
            type="text"
            placeholder="Cari / scan barcode SKU lalu Enter..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="flex-1 px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none"
          >
            <option value="">Semua</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredProducts.map((p) => {
              const inCart = cart.find((i) => i.product.id === p.id)
              return (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  disabled={p.stock === 0}
                  className={`text-left bg-white border rounded-xl p-3.5 transition-all hover:shadow-md active:scale-95 ${
                    inCart
                      ? 'border-blue-400 bg-blue-50 shadow-sm'
                      : 'border-gray-100 shadow-sm hover:border-blue-200'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {p.imageUrl && (
                    <div className="w-full aspect-square rounded-lg overflow-hidden mb-2 bg-gray-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-1 mb-2">
                    <p className="text-sm font-semibold text-gray-900 leading-snug">{p.name}</p>
                    {inCart && (
                      <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
                        {inCart.qty}
                      </span>
                    )}
                  </div>
                  <p className="text-base font-bold text-blue-700">{formatRupiah(p.sellPrice)}</p>
                  <p className="text-xs text-gray-400 mt-1">Stok: {p.stock} {p.unit}</p>
                </button>
              )
            })}
            {filteredProducts.length === 0 && (
              <div className="col-span-full py-16 text-center text-sm text-gray-400">
                Tidak ada produk
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Kanan: Keranjang & Checkout */}
      <div className="w-80 xl:w-96 flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm flex-shrink-0">
        {/* Keranjang */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900">Keranjang</h2>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="text-xs text-red-500 hover:text-red-700">
                Kosongkan
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {cart.length === 0 && (
            <div className="py-16 text-center text-sm text-gray-400">
              <svg className="w-10 h-10 mx-auto mb-3 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Pilih produk dari kiri
            </div>
          )}
          {cart.map((item) => (
            <div key={item.product.id} className="px-5 py-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-sm font-medium text-gray-900 leading-snug">{item.product.name}</p>
                <button onClick={() => removeItem(item.product.id)} className="text-gray-300 hover:text-red-500 flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center gap-2">
                {/* Qty control */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateQty(item.product.id, item.qty - 1)}
                    className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600"
                  >−</button>
                  <input
                    type="number"
                    min={1}
                    max={item.product.stock}
                    value={item.qty}
                    onChange={(e) => updateQty(item.product.id, parseInt(e.target.value) || 1)}
                    className="w-12 text-center text-sm border border-gray-200 rounded py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => updateQty(item.product.id, item.qty + 1)}
                    className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600"
                  >+</button>
                </div>
                {/* Harga (editable) */}
                <div className="flex-1">
                  <input
                    type="number"
                    value={item.price}
                    onChange={(e) => updatePrice(item.product.id, Number(e.target.value))}
                    className="w-full text-right text-sm font-semibold border border-gray-200 rounded px-2 py-0.5 text-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <p className="text-right text-xs text-gray-400 mt-1">
                = {formatRupiah(item.price * item.qty)}
              </p>
            </div>
          ))}
        </div>

        {/* Ringkasan */}
        <div className="px-5 py-4 border-t border-gray-100 space-y-3">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal ({cart.reduce((s, i) => s + i.qty, 0)} item)</span>
              <span>{formatRupiah(subtotal)}</span>
            </div>
            <div className="flex justify-between items-center text-gray-600">
              <span>Diskon (Rp)</span>
              <input
                type="number"
                min={0}
                max={subtotal}
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
                className="w-28 text-right text-sm border border-gray-200 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            {taxRate > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Pajak ({taxRate}%)</span>
                <span>{formatRupiah(taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-gray-900 text-base pt-1 border-t border-gray-100">
              <span>Total</span>
              <span className="text-blue-700">{formatRupiah(total)}</span>
            </div>
          </div>

          {/* Metode Bayar */}
          <div className="grid grid-cols-4 gap-1.5">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.value}
                onClick={() => setPaymentMethod(m.value)}
                className={`text-xs py-1.5 rounded-lg font-medium transition-colors ${
                  paymentMethod === m.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Jumlah Bayar (hanya untuk CASH) */}
          {paymentMethod === 'CASH' && (
            <div>
              <label className="text-xs text-gray-500 font-medium">Bayar (Rp)</label>
              <input
                type="number"
                min={total}
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-lg font-bold text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={total.toString()}
              />
              {/* Quick amounts */}
              <div className="flex gap-1.5 mt-1.5">
                {quickAmounts.map((a) => (
                  <button
                    key={a}
                    onClick={() => setPaidAmount(a.toString())}
                    className="flex-1 text-xs bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded py-1 text-gray-600"
                  >
                    {formatRupiah(a)}
                  </button>
                ))}
              </div>
              {Number(paidAmount) >= total && (
                <p className="text-sm font-semibold text-green-600 mt-2">
                  Kembalian: {formatRupiah(change)}
                </p>
              )}
            </div>
          )}

          <button
            onClick={handleCheckout}
            disabled={
              processing ||
              cart.length === 0 ||
              (paymentMethod === 'CASH' && Number(paidAmount) < total)
            }
            className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors text-base"
          >
            {processing ? 'Memproses...' : `Bayar ${formatRupiah(total)}`}
          </button>
        </div>
      </div>

      {/* Modal Struk */}
      {receipt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="p-6 text-center border-b border-gray-100">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900">Transaksi Berhasil!</h3>
              <p className="text-sm text-gray-500 mt-1">{receipt.invoiceNumber}</p>
            </div>

            <div className="p-5 space-y-2 text-sm">
              {receipt.items?.map((item: any) => (
                <div key={item.id} className="flex justify-between text-gray-700">
                  <span>{item.product.name} ×{Number(item.qty)}</span>
                  <span>{formatRupiah(Number(item.subtotal))}</span>
                </div>
              ))}
              <div className="border-t pt-2 mt-2 space-y-1">
                {Number(receipt.discount) > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>Diskon</span>
                    <span>- {formatRupiah(Number(receipt.discount))}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-gray-900 text-base">
                  <span>Total</span>
                  <span>{formatRupiah(Number(receipt.total))}</span>
                </div>
                {receipt.paymentMethod === 'CASH' && (
                  <>
                    <div className="flex justify-between text-gray-500">
                      <span>Bayar</span>
                      <span>{formatRupiah(Number(receipt.paidAmount))}</span>
                    </div>
                    <div className="flex justify-between text-green-600 font-semibold">
                      <span>Kembalian</span>
                      <span>{formatRupiah(Number(receipt.change))}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="px-5 pb-2 flex gap-3">
              <button
                onClick={printReceipt}
                className="flex-1 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-lg text-sm transition-colors"
              >
                🖨 Cetak Struk
              </button>
              <button
                onClick={closeReceipt}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm transition-colors"
              >
                Transaksi Baru
              </button>
            </div>
            {isAndroid() && (
              <div className="px-5 pb-5">
                <button
                  onClick={() => printViaRawBT(buildReceiptData(receipt, unitName, unitLocation))}
                  className="w-full py-2 border border-blue-200 hover:bg-blue-50 text-blue-700 font-semibold rounded-lg text-xs transition-colors"
                >
                  📶 Cetak via Bluetooth (RawBT)
                </button>
                <p className="text-[10px] text-gray-400 text-center mt-1">Perlu app RawBT terinstall</p>
              </div>
            )}
          </div>

          {/* Struk print (hanya muncul saat cetak) */}
          <Receipt data={buildReceiptData(receipt, unitName, unitLocation)} />
        </div>
      )}
    </div>
  )
}


