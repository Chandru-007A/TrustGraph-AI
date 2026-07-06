/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Fix Next.js build/runtime failures caused by missing prerender manifest
  // in the dev server when a previous build partially exists.
  // (No functional change to your app pages.)
  onDemandEntries: {
    maxInactiveAge: 0,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig

