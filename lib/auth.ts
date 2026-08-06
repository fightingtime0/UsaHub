import { NextAuthOptions, getServerSession } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import type { Role } from '@prisma/client'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { primaryUnit: true },
        })

        if (!user || !user.isActive) return null

        const passwordMatch = await bcrypt.compare(credentials.password, user.password)
        if (!passwordMatch) return null

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
          primaryUnitId: user.primaryUnitId,
          primaryUnitType: user.primaryUnit?.type ?? null,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.tenantId = (user as any).tenantId
        token.primaryUnitId = (user as any).primaryUnitId
        token.primaryUnitType = (user as any).primaryUnitType
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as Role
        session.user.tenantId = token.tenantId as string | null
        session.user.primaryUnitId = token.primaryUnitId as string | null
        session.user.primaryUnitType = token.primaryUnitType as string | null
      }
      return session
    },
  },
}

// Tenant terikat wajib untuk semua role kecuali SUPERADMIN (yang tidak terikat tenant manapun).
// Lempar redirect ke halaman yang tepat kalau dipanggil dari konteks yang salah.
export function requireTenantId(session: Awaited<ReturnType<typeof getSession>>): string {
  const tenantId = session?.user?.tenantId
  if (!tenantId) throw new Error('Sesi ini tidak terikat tenant manapun (kemungkinan akun SUPERADMIN)')
  return tenantId
}

export const getSession = () => getServerSession(authOptions)

export const requireAuth = async () => {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')
  return session
}

// Mirrors middleware.ts's unit route guard, for use inside API routes
// (middleware.ts only matches page routes, not /api/*).
export const hasUnitAccess = (session: Awaited<ReturnType<typeof getSession>>, unitType: string) => {
  if (!session) return false
  if (session.user.role === 'OWNER') return true
  return session.user.primaryUnitType === unitType
}
