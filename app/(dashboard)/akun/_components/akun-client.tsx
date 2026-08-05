'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function AkunClient({
  name: initialName,
  email,
  role,
  roleLabel,
  unitName,
}: {
  name: string
  email: string
  role: string
  roleLabel: string
  unitName: string
}) {
  const router = useRouter()
  const isOwner = role === 'OWNER'

  // ── Profil / nama ───────────────────────────────
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(initialName)
  const [nameInput, setNameInput] = useState(initialName)
  const [nameLoading, setNameLoading] = useState(false)
  const [nameError, setNameError] = useState('')

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault()
    setNameError('')
    if (!nameInput.trim()) return setNameError('Nama tidak boleh kosong')

    setNameLoading(true)
    try {
      const res = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameInput.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setNameError(data.error ?? 'Gagal menyimpan nama')
        return
      }
      setName(data.name)
      setEditingName(false)
      router.refresh()
    } finally {
      setNameLoading(false)
    }
  }

  // ── Password ────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (newPassword.length < 8) {
      return setError('Password baru minimal 8 karakter')
    }
    if (newPassword !== confirmPassword) {
      return setError('Konfirmasi password baru tidak cocok')
    }

    setLoading(true)
    try {
      const res = await fetch('/api/account/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Gagal mengubah password')
        return
      }
      setSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-5">
        <h2 className="font-semibold text-gray-900 text-sm md:text-base mb-4">Profil</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-gray-500">Nama</dt>
            {!isOwner ? (
              <dd className="font-medium text-gray-900 text-right">{name}</dd>
            ) : editingName ? (
              <dd className="flex-1 max-w-[70%]">
                <form onSubmit={handleSaveName} className="flex items-center gap-2 justify-end">
                  <input
                    autoFocus value={nameInput} onChange={(e) => setNameInput(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <button type="submit" disabled={nameLoading}
                    className="text-xs text-indigo-600 hover:underline font-medium flex-shrink-0 disabled:opacity-50">
                    Simpan
                  </button>
                  <button type="button" onClick={() => { setEditingName(false); setNameInput(name); setNameError('') }}
                    className="text-xs text-gray-400 hover:underline flex-shrink-0">
                    Batal
                  </button>
                </form>
              </dd>
            ) : (
              <dd className="font-medium text-gray-900 text-right flex items-center gap-2 justify-end">
                {name}
                <button onClick={() => setEditingName(true)} className="text-xs text-indigo-600 hover:underline font-medium">
                  Edit
                </button>
              </dd>
            )}
          </div>
          {nameError && <p className="text-xs text-red-600 text-right">{nameError}</p>}
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Email</dt>
            <dd className="font-medium text-gray-900 text-right">{email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Role</dt>
            <dd className="font-medium text-gray-900 text-right">{roleLabel}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Unit</dt>
            <dd className="font-medium text-gray-900 text-right">{unitName}</dd>
          </div>
        </dl>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-5">
        <h2 className="font-semibold text-gray-900 text-sm md:text-base mb-4">Ganti Password</h2>
        <form onSubmit={handleSubmit} className="space-y-3 max-w-sm">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Password Saat Ini</label>
            <input
              type="password" required value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Password Baru</label>
            <input
              type="password" required value={newPassword} minLength={8}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="min. 8 karakter"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Konfirmasi Password Baru</label>
            <input
              type="password" required value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-emerald-600">Password berhasil diubah.</p>}

          <button
            type="submit" disabled={loading}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            {loading ? 'Menyimpan...' : 'Simpan Password Baru'}
          </button>
        </form>
      </div>
    </>
  )
}
