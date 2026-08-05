import type { NextConfig } from 'next'
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
}
export default nextConfig

// Enables `next dev` to run against local Cloudflare bindings/emulation
// (no-op outside Cloudflare Pages/Workers tooling).
initOpenNextCloudflareForDev()
