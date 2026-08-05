import { redirect } from 'next/navigation'

// Digabung ke halaman transaksi terpadu (masuk/keluar dalam satu form).
export default function PenjualanPage() {
  redirect('/pertashop/transaksi')
}
