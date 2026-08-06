'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatRupiah, formatDateTime } from '@/lib/utils'

type ProductLite = { id: string; name: string; stock: number; buyPrice: number; sellPrice: number }
type EmployeeLite = { id: string; name: string }
type LogEntry = {
  id: string
  direction: 'IN' | 'OUT' | 'STOK'
  productName: string
  liters: number | null
  price: number | null
  total: number | null
  shift: string | null
  actualStock: number | null
  lossLiters: number | null
  note: string | null
  at: string
}
type ExpenseDraft = { amount: number; description: string }

const RESET_CONFIRM_PHRASE = 'RESET PERTASHOP'
const SHIFT_OPTIONS = ['Shift 1', 'Shift 2', 'Longshift']

function todayStr() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function TransaksiClient({
  products,
  log,
  role,
  employees,
  currentEmployeeId,
}: {
  products: ProductLite[]
  log: LogEntry[]
  role: string
  employees: EmployeeLite[]
  currentEmployeeId: string | null
}) {
  const router = useRouter()
  const canManageProduct = ['OWNER', 'MANAGER'].includes(role)
  const isOwner = role === 'OWNER'

  // ── Laporan Shift — satu form, satu kali simpan ────────────
  const [loading, setLoading] = useState(false)
  const [shift, setShift] = useState('')
  const [employeeId, setEmployeeId] = useState(currentEmployeeId ?? '')
  const [direction, setDirection] = useState<'IN' | 'OUT' | 'STOK'>('IN')
  const [productId, setProductId] = useState(products[0]?.id ?? '')
  const [liters, setLiters] = useState('')
  const [price, setPrice] = useState(products[0] ? String(products[0].buyPrice) : '')
  const [actualStock, setActualStock] = useState('')
  const [readingType, setReadingType] = useState<'OPENING' | 'CLOSING'>('OPENING')
  const [date, setDate] = useState(todayStr())
  const [depositAmount, setDepositAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  // Biaya pengeluaran — dikumpulkan lokal dulu, baru ikut tersimpan saat "Simpan Laporan"
  const [expenses, setExpenses] = useState<ExpenseDraft[]>([])
  const [expAmount, setExpAmount] = useState('')
  const [expDesc, setExpDesc] = useState('')
  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0)

  const selectedProduct = products.find((p) => p.id === productId) ?? null

  function applyDefaultPrice(dir: 'IN' | 'OUT', prod: ProductLite | null) {
    setPrice(prod ? String(dir === 'IN' ? prod.buyPrice : prod.sellPrice) : '')
  }

  function onDirectionChange(dir: 'IN' | 'OUT' | 'STOK') {
    setDirection(dir)
    if (dir !== 'STOK') applyDefaultPrice(dir, selectedProduct)
  }

  function onProductChange(id: string) {
    setProductId(id)
    if (direction !== 'STOK') applyDefaultPrice(direction, products.find((p) => p.id === id) ?? null)
  }

  const litersNum = parseFloat(liters) || 0
  const expectedStock = selectedProduct
    ? direction === 'IN'
      ? selectedProduct.stock + litersNum
      : direction === 'OUT'
        ? selectedProduct.stock - litersNum
        : selectedProduct.stock
    : 0
  const actualNum = actualStock === '' ? null : parseFloat(actualStock)
  const selisih = actualNum !== null ? expectedStock - actualNum : null
  const total = litersNum * (parseFloat(price) || 0)

  // Laporan ini sekaligus laporan setoran: setoran seharusnya = transaksi hari ini − biaya pengeluaran
  const setoranSeharusnya = total - expenseTotal
  const depositDiff = depositAmount !== '' ? parseFloat(depositAmount) - setoranSeharusnya : null

  function handleAddExpense() {
    const amt = parseFloat(expAmount)
    if (!amt || amt <= 0 || !expDesc.trim()) return
    setExpenses((prev) => [...prev, { amount: amt, description: expDesc.trim() }])
    setExpAmount('')
    setExpDesc('')
  }

  function handleRemoveExpense(idx: number) {
    setExpenses((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!productId) return setError('Pilih produk BBM')
    if (!shift) return setError('Pilih shift')
    if (actualStock === '') return setError('Stok sekarang (hasil ukur tangki) wajib diisi')
    if (direction !== 'STOK' && (!liters || litersNum <= 0)) return setError('Jumlah liter harus lebih dari 0')
    if (depositAmount === '') return setError('Setoran uang wajib diisi')

    setLoading(true)
    try {
      const payload: Record<string, unknown> = {
        fuelProductId: productId,
        direction,
        date,
        shift,
        employeeId: employeeId || null,
        actualStock: actualNum,
        expenses,
        depositAmount: parseFloat(depositAmount),
        note: note || null,
      }
      if (direction === 'STOK') {
        payload.readingType = readingType
      } else {
        payload.liters = litersNum
        payload.price = parseFloat(price)
      }

      const res = await fetch('/api/pertashop/shift-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Gagal menyimpan laporan')
        return
      }
      setLiters('')
      setActualStock('')
      setExpenses([])
      setExpAmount('')
      setExpDesc('')
      setDepositAmount('')
      setNote('')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  // ── Kelola produk (tambah/edit/nonaktif) ───────────────────
  const [showNewProduct, setShowNewProduct] = useState(false)
  const [npName, setNpName] = useState('')
  const [npBuy, setNpBuy] = useState('')
  const [npSell, setNpSell] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [epBuy, setEpBuy] = useState('')
  const [epSell, setEpSell] = useState('')
  const [productLoading, setProductLoading] = useState(false)

  async function handleNewProduct(e: React.FormEvent) {
    e.preventDefault()
    setProductLoading(true)
    try {
      const res = await fetch('/api/pertashop/produk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: npName, buyPrice: parseFloat(npBuy), sellPrice: parseFloat(npSell) }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error ?? 'Gagal menambah produk')
        return
      }
      setNpName(''); setNpBuy(''); setNpSell(''); setShowNewProduct(false)
      router.refresh()
    } finally {
      setProductLoading(false)
    }
  }

  function openEditProduct(p: ProductLite) {
    setEditingId(p.id)
    setEpBuy(String(p.buyPrice))
    setEpSell(String(p.sellPrice))
  }

  async function handleEditProduct(e: React.FormEvent) {
    e.preventDefault()
    if (!editingId) return
    setProductLoading(true)
    try {
      const res = await fetch('/api/pertashop/produk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, buyPrice: parseFloat(epBuy), sellPrice: parseFloat(epSell) }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error ?? 'Gagal menyimpan perubahan')
        return
      }
      setEditingId(null)
      router.refresh()
    } finally {
      setProductLoading(false)
    }
  }

  async function handleDeactivateProduct(p: ProductLite) {
    if (!confirm(`Nonaktifkan produk ${p.name}? Produk tidak akan muncul lagi di form transaksi.`)) return
    setProductLoading(true)
    try {
      const res = await fetch('/api/pertashop/produk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id, isActive: false }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error ?? 'Gagal menonaktifkan produk')
        return
      }
      router.refresh()
    } finally {
      setProductLoading(false)
    }
  }

  // ── Reset data (danger zone, OWNER only) ───────────────────
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState('')

  async function handleReset() {
    if (resetConfirmText !== RESET_CONFIRM_PHRASE) return
    setResetError('')
    setResetLoading(true)
    try {
      const res = await fetch('/api/pertashop/reset', { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        setResetError(data.error ?? 'Gagal mereset data')
        return
      }
      setResetConfirmText('')
      router.refresh()
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/pertashop" className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Kembali">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Laporan Shift Pertashop</h1>
          <p className="text-xs md:text-sm text-gray-500">Satu form: transaksi, biaya pengeluaran, dan setoran — simpan sekali jalan</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Form + kelola produk */}
        <div className="space-y-4">
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Shift *</label>
                <select
                  value={shift} onChange={(e) => setShift(e.target.value)} required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">— pilih shift —</option>
                  {SHIFT_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Karyawan</label>
                <select
                  value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">— tidak diisi —</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button" onClick={() => onDirectionChange('IN')}
                className={`py-2 rounded-lg text-xs sm:text-sm font-semibold border transition-colors ${
                  direction === 'IN' ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Masuk (Stok)
              </button>
              <button
                type="button" onClick={() => onDirectionChange('OUT')}
                className={`py-2 rounded-lg text-xs sm:text-sm font-semibold border transition-colors ${
                  direction === 'OUT' ? 'bg-sky-600 border-sky-600 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Keluar (Jual)
              </button>
              <button
                type="button" onClick={() => onDirectionChange('STOK')}
                className={`py-2 rounded-lg text-xs sm:text-sm font-semibold border transition-colors ${
                  direction === 'STOK' ? 'bg-amber-500 border-amber-500 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Stok Sekarang
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Produk BBM</label>
              <select
                value={productId} onChange={(e) => onProductChange(e.target.value)} required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {products.length === 0 && <option value="">— belum ada produk —</option>}
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (stok {p.stock.toLocaleString('id-ID', { maximumFractionDigits: 2 })} L)
                  </option>
                ))}
              </select>
            </div>

            {direction === 'STOK' ? (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Jenis</label>
                <select
                  value={readingType} onChange={(e) => setReadingType(e.target.value as 'OPENING' | 'CLOSING')}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="OPENING">Buka (awal shift)</option>
                  <option value="CLOSING">Tutup (akhir shift)</option>
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Jumlah (L)</label>
                  <input
                    type="number" step="0.001" min="0.001" required value={liters}
                    onChange={(e) => setLiters(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Harga / L</label>
                  <input
                    type="number" step="1" min="1" required value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Stok Sekarang (hasil ukur tangki) *</label>
              <input
                type="number" step="0.001" min="0" required value={actualStock}
                onChange={(e) => setActualStock(e.target.value)}
                placeholder={selectedProduct ? `perkiraan sistem: ${expectedStock.toLocaleString('id-ID', { maximumFractionDigits: 2 })} L` : ''}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {selisih !== null && (
                <p className={`text-xs mt-1 ${selisih === 0 ? 'text-gray-400' : selisih > 0 ? 'text-red-500' : 'text-blue-500'}`}>
                  {selisih === 0
                    ? 'Sesuai perkiraan sistem'
                    : selisih > 0
                      ? `Selisih (susut/penguapan): ${selisih.toLocaleString('id-ID', { maximumFractionDigits: 2 })} L`
                      : `Selisih (lebih): ${Math.abs(selisih).toLocaleString('id-ID', { maximumFractionDigits: 2 })} L`}
                </p>
              )}
            </div>

            {/* Biaya Pengeluaran */}
            <div className="rounded-lg border border-amber-100 bg-amber-50/40 p-3 space-y-2">
              <p className="text-xs font-semibold text-amber-800">Biaya Pengeluaran</p>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  type="number" step="1" min="1" value={expAmount} onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="Jumlah (Rp)"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  type="button" onClick={handleAddExpense}
                  className="px-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors"
                >
                  Tambah
                </button>
              </div>
              <input
                type="text" value={expDesc} onChange={(e) => setExpDesc(e.target.value)}
                placeholder="Keterangan (mis. beli oli mesin)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              {expenses.length > 0 && (
                <div className="divide-y divide-amber-100 -mx-1">
                  {expenses.map((ex, i) => (
                    <div key={i} className="px-1 py-1.5 flex items-center justify-between gap-2 text-sm">
                      <span className="text-gray-700 truncate">{ex.description}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="font-medium text-red-600">−{formatRupiah(ex.amount)}</span>
                        <button type="button" onClick={() => handleRemoveExpense(i)} className="text-gray-400 hover:text-red-500 text-xs" aria-label="Hapus">
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between text-sm font-semibold pt-1.5 border-t border-amber-100">
                <span className="text-amber-800 text-xs">Total Biaya Pengeluaran</span>
                <span className="text-red-600">{formatRupiah(expenseTotal)}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tanggal</label>
              <input
                type="date" required value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Tabel kalkulasi — laporan jualan sekaligus laporan setoran hari ini */}
            <div className="rounded-lg bg-gray-50 p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 text-xs">Laporan jualan hari ini</span>
                <span className="font-semibold text-gray-900">{formatRupiah(total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 text-xs">Biaya pengeluaran</span>
                <span className="font-semibold text-red-600">−{formatRupiah(expenseTotal)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-1">
                <span className="text-gray-600 text-xs font-medium">Setoran seharusnya</span>
                <span className="font-bold text-gray-900">{formatRupiah(setoranSeharusnya)}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Setoran Uang (Rp) *</label>
              <input
                type="number" step="1" min="0" required value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="mis. 1250000"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {depositDiff !== null && !isNaN(depositDiff) && (
                <p className={`text-xs mt-1 font-medium ${
                  depositDiff === 0 ? 'text-emerald-600' : depositDiff > 0 ? 'text-blue-600' : 'text-red-600'
                }`}>
                  {depositDiff === 0
                    ? '✓ Setoran cocok dengan laporan'
                    : depositDiff > 0
                      ? `Setoran lebih ${formatRupiah(depositDiff)}`
                      : `Setoran kurang ${formatRupiah(Math.abs(depositDiff))}`}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Berita Acara</label>
              <textarea
                value={note} onChange={(e) => setNote(e.target.value)} rows={3}
                placeholder="mis. serah terima shift, kondisi tangki, dll"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit" disabled={loading || !productId}
              className="w-full text-white rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 bg-emerald-600 hover:bg-emerald-700"
            >
              {loading ? 'Menyimpan...' : 'Simpan Laporan'}
            </button>
          </form>

          {canManageProduct && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-5">
              <button
                onClick={() => setShowNewProduct((v) => !v)}
                className="w-full text-left text-sm font-semibold text-gray-900 flex items-center justify-between"
              >
                Tambah Produk BBM
                <span className="text-gray-400">{showNewProduct ? '−' : '+'}</span>
              </button>
              {showNewProduct && (
                <form onSubmit={handleNewProduct} className="mt-3 space-y-3">
                  <input
                    type="text" required value={npName} onChange={(e) => setNpName(e.target.value)}
                    placeholder="Nama (mis. Pertamax)"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number" step="1" min="1" required value={npBuy} onChange={(e) => setNpBuy(e.target.value)}
                      placeholder="Harga beli/L"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <input
                      type="number" step="1" min="1" required value={npSell} onChange={(e) => setNpSell(e.target.value)}
                      placeholder="Harga jual/L"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <button
                    type="submit" disabled={productLoading}
                    className="w-full border border-emerald-600 text-emerald-700 rounded-lg py-2 text-sm font-semibold hover:bg-emerald-50 transition-colors disabled:opacity-50"
                  >
                    Tambah Produk
                  </button>
                </form>
              )}
            </div>
          )}

          {canManageProduct && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="px-4 md:px-5 py-3 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900 text-sm">Kelola Produk BBM</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {products.length === 0 && (
                  <p className="px-4 md:px-5 py-4 text-sm text-gray-400 text-center">Belum ada produk</p>
                )}
                {products.map((p) => (
                  <div key={p.id} className="px-4 md:px-5 py-3">
                    {editingId === p.id ? (
                      <form onSubmit={handleEditProduct} className="space-y-2">
                        <p className="text-sm font-medium text-gray-900">{p.name}</p>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number" step="1" min="1" required value={epBuy} onChange={(e) => setEpBuy(e.target.value)}
                            placeholder="Harga beli/L"
                            className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                          <input
                            type="number" step="1" min="1" required value={epSell} onChange={(e) => setEpSell(e.target.value)}
                            placeholder="Harga jual/L"
                            className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setEditingId(null)}
                            className="flex-1 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50">
                            Batal
                          </button>
                          <button type="submit" disabled={productLoading}
                            className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold">
                            Simpan
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">{p.name}</p>
                          <p className="text-xs text-gray-400">
                            Beli {formatRupiah(p.buyPrice)} · Jual {formatRupiah(p.sellPrice)}
                          </p>
                        </div>
                        <div className="flex gap-3 flex-shrink-0">
                          <button onClick={() => openEditProduct(p)} className="text-xs text-emerald-600 hover:underline font-medium">Edit</button>
                          <button onClick={() => handleDeactivateProduct(p)} className="text-xs text-red-500 hover:underline font-medium">Nonaktif</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Riwayat */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-4 md:px-5 py-3 md:py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm md:text-base">Riwayat Transaksi</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="px-4 md:px-5 py-2.5 font-medium">Waktu</th>
                  <th className="px-3 py-2.5 font-medium">Arah</th>
                  <th className="px-3 py-2.5 font-medium">Produk</th>
                  <th className="px-3 py-2.5 font-medium text-right">Liter</th>
                  <th className="px-3 py-2.5 font-medium text-right">Harga/L</th>
                  <th className="px-3 py-2.5 font-medium text-right">Total</th>
                  <th className="px-3 py-2.5 font-medium text-right">Stok Skrg</th>
                  <th className="px-3 py-2.5 font-medium text-right">Selisih</th>
                  <th className="px-3 py-2.5 font-medium">Shift</th>
                  <th className="px-4 md:px-5 py-2.5 font-medium">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {log.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-5 py-6 text-center text-gray-400">Belum ada transaksi</td>
                  </tr>
                )}
                {log.map((t) => (
                  <tr key={`${t.direction}-${t.id}`}>
                    <td className="px-4 md:px-5 py-3 text-gray-600 whitespace-nowrap">{formatDateTime(t.at)}</td>
                    <td className="px-3 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        t.direction === 'IN' ? 'bg-emerald-100 text-emerald-700' : t.direction === 'OUT' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {t.direction === 'IN' ? 'Masuk' : t.direction === 'OUT' ? 'Keluar' : 'Stok'}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-medium text-gray-900 whitespace-nowrap">{t.productName}</td>
                    <td className="px-3 py-3 text-right text-gray-800">{t.liters !== null ? t.liters.toLocaleString('id-ID', { maximumFractionDigits: 3 }) : '—'}</td>
                    <td className="px-3 py-3 text-right text-gray-600">{t.price !== null ? formatRupiah(t.price) : '—'}</td>
                    <td className="px-3 py-3 text-right font-semibold text-gray-900">{t.total !== null ? formatRupiah(t.total) : '—'}</td>
                    <td className="px-3 py-3 text-right text-gray-700">
                      {t.actualStock !== null ? t.actualStock.toLocaleString('id-ID', { maximumFractionDigits: 2 }) : '—'}
                    </td>
                    <td className={`px-3 py-3 text-right font-medium ${
                      t.lossLiters === null ? 'text-gray-300' : t.lossLiters === 0 ? 'text-gray-400' : t.lossLiters > 0 ? 'text-red-500' : 'text-blue-500'
                    }`}>
                      {t.lossLiters !== null ? t.lossLiters.toLocaleString('id-ID', { maximumFractionDigits: 2 }) : '—'}
                    </td>
                    <td className="px-3 py-3 text-gray-500">{t.shift ?? '—'}</td>
                    <td className="px-4 md:px-5 py-3 text-gray-500 max-w-[200px] truncate" title={t.note ?? ''}>{t.note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isOwner && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 md:p-5">
          <h2 className="font-semibold text-red-800 text-sm md:text-base mb-1">Zona Berbahaya — Reset Data Pertashop</h2>
          <p className="text-xs md:text-sm text-red-700 mb-3">
            Menghapus <strong>seluruh riwayat transaksi masuk & keluar</strong> dan mengembalikan{' '}
            <strong>stok semua produk BBM ke 0</strong>. Tindakan ini <strong>tidak bisa dibatalkan</strong>.
            Rekonsiliasi setoran tidak terhapus.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <input
              type="text" value={resetConfirmText} onChange={(e) => setResetConfirmText(e.target.value)}
              placeholder={`Ketik "${RESET_CONFIRM_PHRASE}" untuk konfirmasi`}
              className="flex-1 border border-red-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <button
              onClick={handleReset}
              disabled={resetConfirmText !== RESET_CONFIRM_PHRASE || resetLoading}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors flex-shrink-0"
            >
              {resetLoading ? 'Mereset...' : 'Reset Sekarang'}
            </button>
          </div>
          {resetError && <p className="text-xs text-red-700 mt-2">{resetError}</p>}
        </div>
      )}
    </div>
  )
}
