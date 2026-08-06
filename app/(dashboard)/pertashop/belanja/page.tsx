import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getTransaksiPageData } from '../_lib/get-transaksi-data'
import { TransaksiClient } from '../transaksi/_components/transaksi-client'

export default async function BelanjaPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const data = await getTransaksiPageData(session)
  if (!data) return <p className="text-red-500">Unit Pertashop tidak ditemukan.</p>

  return <TransaksiClient {...data} lockedDirection="IN" />
}
