import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PertashopSubnav } from './_components/pertashop-subnav'

export default async function PertashopLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div>
      <PertashopSubnav role={session.user.role} />
      {children}
    </div>
  )
}
