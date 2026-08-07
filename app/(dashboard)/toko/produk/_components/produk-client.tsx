'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatRupiah } from '@/lib/utils'
import { ImageUpload } from '@/components/image-upload'
import type { Role } from '@prisma/client'

type Category = { id: string; name: string }
type Product = {
  id: string
  name: string
  sku: string | null
  unit: string
  costPrice: number
  sellPrice: number
  stock: number
  minStock: number
  imageUrl: string | null
  category: Category | null
}

type Props = {
  initialProducts: Product[]
  categories: Category[]
  unitId: string
  userRole: Role
}

const SATUAN = ['pcs', 'kg', 'gram', 'liter', 'ml', 'botol', 'box', 'pak', 'lusin', 'karung']

const canEdit = (role: Role) => ['OWNER', 'MANAGER'].includes(role)

export function ProdukClient({ initialProducts, categories, unitId, userRole }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterLow, setFilterLow] = useState(false)

  // Modal form
  const [showForm, setShowForm] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const emptyForm = { name: '', sku: '', unit: 'pcs', costPrice: '', sellPrice: '', stock: '', minStock: '', categoryId: '', imageUrl: null as string | null }
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')

  const filtered = products.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku ?? '').toLowerCase().includes(search.toLowerCase())
    const matchCat = !filterCat || p.category?.id === filterCat
    const matchLow = !filterLow || p.stock <= p.minStock
    return matchSearch && matchCat && matchLow
  })

  function openAdd() {
    setEditProduct(null)
    setForm(emptyForm)
    setFormError('')
    setShowForm(true)
  }

  function openEdit(p: Product) {
    setEditProduct(p)
    setForm({
      name: p.name,
      sku: p.sku ?? '',
      unit: p.unit,
      costPrice: p.costPrice.toString(),
      sellPrice: p.sellPrice.toString(),
      stock: p.stock.toString(),
      minStock: p.minStock.toString(),
      categoryId: p.category?.id ?? '',
      imageUrl: p.imageUrl,
    })
    setFormError('')
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    setSaving(true)

    const payload = {
      name: form.name,
      sku: form.sku || null,
      unit: form.unit,
      costPrice: parseFloat(form.costPrice),
      sellPrice: parseFloat(form.sellPrice),
      stock: parseFloat(form.stock || '0'),
      minStock: parseFloat(form.minStock || '0'),
      categoryId: form.categoryId || null,
      imageUrl: form.imageUrl,
    }

    try {
      const url = editProduct ? `/api/toko/produk/${editProduct.id}` : '/api/toko/produk'
      const method = editProduct ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        setFormError(err.error ?? 'Gagal menyimpan')
        return
      }

      const saved = await res.json()
      const normalized: Product = {
        ...saved,
        costPrice: Number(saved.costPrice),
        sellPrice: Number(saved.sellPrice),
        stock: Number(saved.stock),
        minStock: Number(saved.minStock),
        imageUrl: saved.imageUrl ?? null,
        category: saved.category ?? null,
      }

      if (editProduct) {
        setProducts((prev) => prev.map((p) => (p.id === editProduct.id ? normalized : p)))
      } else {
        setProducts((prev) => [...prev, normalized].sort((a, b) => a.name.localeCompare(b.name)))
      }

      setShowForm(false)
    } catch {
      setFormError('Terjadi kesalahan jaringan')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Hapus produk "${name}"? Stok dan riwayat tetap tersimpan.`)) return
    await fetch(`/api/toko/produk/${id}`, { method: 'DELETE' })
    setProducts((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Produk & Stok</h1>
          <p className="text-sm text-gray-500">{filtered.length} produk ditampilkan</p>
        </div>
        {canEdit(userRole) && (
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Tambah Produk
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Cari nama / SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 px-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Semua Kategori</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
          <input
            type="checkbox"
            checked={filterLow}
            onChange={(e) => setFilterLow(e.target.checked)}
            className="accent-red-500"
          />
          <span className="text-gray-700">Stok Menipis</span>
        </label>
      </div>

      {/* Tabel Produk */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-5 py-3 font-semibold w-14"></th>
                <th className="px-5 py-3 font-semibold">Produk</th>
                <th className="px-5 py-3 font-semibold">Kategori</th>
                <th className="px-5 py-3 font-semibold text-right">Harga Modal</th>
                <th className="px-5 py-3 font-semibold text-right">Harga Jual</th>
                <th className="px-5 py-3 font-semibold text-right">Stok</th>
                <th className="px-5 py-3 font-semibold text-right">Min Stok</th>
                {canEdit(userRole) && <th className="px-5 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-gray-400">
                    Tidak ada produk ditemukan
                  </td>
                </tr>
              )}
              {filtered.map((p) => {
                const isLow = p.stock <= p.minStock
                return (
                  <tr key={p.id} className={`hover:bg-gray-50 ${isLow ? 'bg-red-50/40' : ''}`}>
                    <td className="px-5 py-3.5">
                      <div className="w-10 h-10 rounded-lg border border-gray-100 bg-gray-50 overflow-hidden flex items-center justify-center">
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-gray-900">{p.name}</p>
                      {p.sku && <p className="text-xs text-gray-400">{p.sku}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">
                      {p.category?.name ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right text-gray-700">{formatRupiah(p.costPrice)}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-gray-900">{formatRupiah(p.sellPrice)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <span className={`font-semibold ${isLow ? 'text-red-600' : 'text-gray-900'}`}>
                        {p.stock}
                      </span>
                      <span className="text-gray-400 ml-1 text-xs">{p.unit}</span>
                      {isLow && (
                        <span className="ml-2 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">Menipis</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right text-gray-500">
                      {p.minStock} <span className="text-xs">{p.unit}</span>
                    </td>
                    {canEdit(userRole) && (
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => openEdit(p)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(p.id, p.name)}
                            className="text-xs text-red-500 hover:text-red-700 font-medium"
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">
                {editProduct ? 'Edit Produk' : 'Tambah Produk Baru'}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {formError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-lg">
                  {formError}
                </div>
              )}

              <ImageUpload
                value={form.imageUrl}
                onChange={(url) => setForm({ ...form, imageUrl: url })}
                folder="produk"
              />

              <Field label="Nama Produk *">
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className={inputCls}
                  placeholder="contoh: Beras Premium"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="SKU">
                  <input
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    className={inputCls}
                    placeholder="TK-001"
                  />
                </Field>
                <Field label="Satuan *">
                  <select
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className={inputCls}
                    required
                  >
                    {SATUAN.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Harga Modal (Rp) *">
                  <input
                    type="number"
                    min={0}
                    value={form.costPrice}
                    onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                    required
                    className={inputCls}
                    placeholder="0"
                  />
                </Field>
                <Field label="Harga Jual (Rp) *">
                  <input
                    type="number"
                    min={0}
                    value={form.sellPrice}
                    onChange={(e) => setForm({ ...form, sellPrice: e.target.value })}
                    required
                    className={inputCls}
                    placeholder="0"
                  />
                </Field>
              </div>

              {!editProduct && (
                <Field label="Stok Awal">
                  <input
                    type="number"
                    min={0}
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                    className={inputCls}
                    placeholder="0"
                  />
                </Field>
              )}

              <Field label="Stok Minimum (alert)">
                <input
                  type="number"
                  min={0}
                  value={form.minStock}
                  onChange={(e) => setForm({ ...form, minStock: e.target.value })}
                  className={inputCls}
                  placeholder="0"
                />
              </Field>

              <Field label="Kategori">
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  className={inputCls}
                >
                  <option value="">— Tanpa Kategori —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2.5 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors"
                >
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'


