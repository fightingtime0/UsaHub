import { PrismaClient } from '@prisma/client'
import { Pool } from '@neondatabase/serverless'
import { PrismaNeon } from '@prisma/adapter-neon'

// Neon serverless driver connects over WebSocket (fetch-based on Cloudflare Workers,
// native `WebSocket` global on Node 21+/22+ — no `ws` polyfill needed on either target).
// Required (instead of a plain TCP connection) so this app can run on Cloudflare Workers,
// not just Vercel's Node.js runtime.
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaNeon(pool)

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
