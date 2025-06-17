import MillionLint from '@million/lint';
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
  webpack: (config, { isServer }) => {
    // Externalize server-only modules from client bundle
    if (!isServer) {
      config.externals = config.externals || []
      config.externals.push({
        'pg': 'commonjs pg',
        'ioredis': 'commonjs ioredis',
        'dns': 'commonjs dns',
        'net': 'commonjs net',
        'tls': 'commonjs tls',
        'fs': 'commonjs fs',
        'path': 'commonjs path',
        'crypto': 'commonjs crypto'
      })
    }
    return config
  },
  // Explicitly mark server-only packages
  serverComponentsExternalPackages: ['pg', 'ioredis']
}
