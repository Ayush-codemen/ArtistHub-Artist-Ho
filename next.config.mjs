/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Suppress per-request logs in dev to reduce polling noise
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
}

export default nextConfig
