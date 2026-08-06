'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { UnitType, Role } from '@prisma/client'

type BusinessUnitLite = { id: string; name: string; type: UnitType; isActive: boolean }
type UserLite = { id: string; name: string; email: string; role: Role; isActive: boolean }

const ALL_TYPES: UnitType[] = ['RETAIL', 'HOMESTAY', 'RESTAURANT', 'LODGING', 'PERTASHOP']
const TYPE_LABEL: Record<UnitType, string> = {
  RETAIL: 'Toko',
  HOMESTAY: 'Homestay',
  RESTAURANT: 'Restoran',
  LODGING: 'Penginapan',
  PERTASHOP: 'Pertashop',
}
const ROLE_LABEL: Record<Role, string> = {
  SUPERADMIN: 'Superadmin',
  OWNER: 'Owner',
  MANAGER: 'Manager',
  STAFF: 'Staff',
  CASHIER: 'Kasir',
}

export function TenantDetailClient({
  tenant,
  businessUnits,
  users,
}: {
  tenant: { id: string; name: string; slug: string; isActive: boolean }
  businessUnits: BusinessUnitLite[]
  users: UserLite[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [addingType, setAddingType] = useState<UnitType | null>(null)
  const [newUnitName, setNewUnitName] = useState('')
  const [newUnitLocation, setNewUnitLocation] = useState('')

  async function handleToggleTenant() {
    if (!confirm(tenant.isActive ? `Suspend tenant "${tenant.name}"? Semua user tenant ini tidak akan bisa login.` : `Aktifkan kembali tenant "${tenant.name}"?`)) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/superadmin/tenants/${tenant.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !tenant.isActive }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Gagal mengubah status tenant')
        return
      }
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  function openAddUnit(type: UnitType) {
    setAddingType(type)
    setNewUnitName('')
    setNewUnitLocation('')
  }

  async function handleAddUnit(e: React.FormEvent) {
    e.preventDefault()
    if (!addingType) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/superadmin/tenants/${tenant.id}/units`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: addingType, name: newUnitName, location: newUnitLocation || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Gagal mengaktifkan unit')
        return
      }
      setAddingType(null)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleUnit(unitId: string, currentlyActive: boolean) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/superadmin/tenants/${tenant.id}/units`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitId, isActive: !currentlyActive }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Gagal mengubah status unit')
        return
      }
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  const unitsByType = new Map(businessUnits.map((u) => [u.type, u]))

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/superadmin" className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Kembali">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 truncate">{tenant.name}</h1>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                tenant.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
              }`}
            >
              {tenant.isActive ? 'Aktif' : 'Suspend'}
            </span>
          </div>
          <p className="text-xs md:text-sm text-gray-500 mt-0.5">/{tenant.slug}</p>
        </div>
        <button
          onClick={handleToggleTenant}
          disabled={loading}
          className={`flex-shrink-0 text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${
            tenant.isActive
              ? 'bg-red-50 text-red-700 hover:bg-red-100'
              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
          }`}
        >
          {tenant.isActive ? 'Suspend Tenant' : 'Aktifkan Tenant'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Unit bisnis */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-4 md:px-5 py-3 md:py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm md:text-base">Unit Bisnis</h2>
            <p className="text-xs text-gray-500 mt-0.5">Jenis unit yang aktif untuk tenant ini</p>
          </div>
          <div className="divide-y divide-gray-50">
            {ALL_TYPES.map((type) => {
              const unit = unitsByType.get(type)
              return (
                <div key={type} className="px-4 md:px-5 py-3">
                  {addingType === type ? (
                    <form onSubmit={handleAddUnit} className="space-y-2">
                      <p className="text-sm font-medium text-gray-900">{TYPE_LABEL[type]}</p>
                      <input
                        type="text" required value={newUnitName} onChange={(e) => setNewUnitName(e.target.value)}
                        placeholder="Nama unit (mis. Toko Jetis)"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                      <input
                        type="text" value={newUnitLocation} onChange={(e) => setNewUnitLocation(e.target.value)}
                        placeholder="Lokasi (opsional)"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setAddingType(null)}
                          className="flex-1 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50">
                          Batal
                        </button>
                        <button type="submit" disabled={loading}
                          className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold">
                          Aktifkan
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">{TYPE_LABEL[type]}</p>
                        {unit ? (
                          <p className="text-xs text-gray-400 truncate">{unit.name}</p>
                        ) : (
                          <p className="text-xs text-gray-300">Belum diaktifkan</p>
                        )}
                      </div>
                      {unit ? (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              unit.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {unit.isActive ? 'Aktif' : 'Nonaktif'}
                          </span>
                          <button
                            onClick={() => handleToggleUnit(unit.id, unit.isActive)}
                            disabled={loading}
                            className="text-xs text-indigo-600 hover:underline font-medium disabled:opacity-50"
                          >
                            {unit.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => openAddUnit(type)}
                          className="text-xs text-indigo-600 hover:underline font-medium flex-shrink-0"
                        >
                          + Aktifkan
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Users */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-4 md:px-5 py-3 md:py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm md:text-base">User</h2>
            <p className="text-xs text-gray-500 mt-0.5">Akun login milik tenant ini</p>
          </div>
          <div className="divide-y divide-gray-50">
            {users.length === 0 && (
              <p className="px-4 md:px-5 py-4 text-sm text-gray-400 text-center">Belum ada user</p>
            )}
            {users.map((u) => (
              <div key={u.id} className="px-4 md:px-5 py-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                  <p className="text-xs text-gray-400 truncate">{u.email}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">
                    {ROLE_LABEL[u.role]}
                  </span>
                  {!u.isActive && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">Nonaktif</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
