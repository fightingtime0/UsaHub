import { redirect } from 'next/navigation'

// Pencatatan stok kini terpadu di tiap transaksi (lihat halaman transaksi).
// Riwayat pengukuran OPENING/CLOSING lama tetap tersimpan di database.
export default function StokPage() {
  redirect('/pertashop/transaksi')
}
